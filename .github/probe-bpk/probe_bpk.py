"""Can an existing stealth-browser tool get past peraturan.bpk.go.id's Cloudflare check?

Run by .github/workflows/probe-bpk.yml on a GitHub runner. One tool per run:

    python probe_bpk.py <tool> <outdir>      tool: playwright | seleniumbase | scrapling | camoufox

`playwright` is the control (a plain browser, which failed on 2026-11-21). For each tool the
probe opens the home page, waits up to 60 s for the challenge to clear, then opens one
regulation's detail page and fetches its PDF from inside the browser. Last, it tries the
"browser once, plain HTTP after" pattern: the browser's cookies and user agent reused by
curl_cffi. Prints one JSON line and writes <outdir>/<tool>.json and a screenshot.
PDFs are never written to disk: only their size and first bytes are reported.
"""

import json
import os
import re
import sys
import time
from pathlib import Path
from urllib.parse import urljoin

BASE = "https://peraturan.bpk.go.id"
START = BASE + "/"
SEARCH = BASE + "/Search?keywords=pertambangan+mineral+dan+batubara"
WAIT_S = 60
PROXY = os.environ.get("PROBE_PROXY")  # only for testing behind a local proxy

FETCH_JS = """async (url) => {
  try {
    const r = await fetch(url, {credentials: 'include'});
    const b = new Uint8Array(await r.arrayBuffer());
    return {status: r.status, type: r.headers.get('content-type'), bytes: b.length,
            head: String.fromCharCode(...b.slice(0, 5))};
  } catch (e) { return {error: String(e)}; }
}"""


def challenged(title: str, html: str) -> bool:
    # `_cf_chl_opt` is set only on the challenge page (normal pages also load
    # /cdn-cgi/challenge-platform/ scripts, so that path is no signal)
    return "_cf_chl_opt" in html or title.strip().lower() in ("just a moment...", "tunggu sebentar...")


class PwDriver:
    """Playwright-style page (Playwright, Patchright under Scrapling, Camoufox)."""

    def __init__(self, page, click_checkbox=False):
        self.page, self.click_checkbox = page, click_checkbox

    def open(self, url):
        self.page.goto(url, wait_until="domcontentloaded", timeout=60_000)

    def solve(self):
        if not self.click_checkbox:
            return
        # Turnstile sits in an iframe inside a closed shadow root; its frame element still has a
        # box, and the checkbox is at its left edge. Same approach as Byparr/Scrapling.
        for f in self.page.frames:
            if "challenges.cloudflare.com" in f.url:
                box = f.frame_element().bounding_box()
                if box:
                    self.page.mouse.click(box["x"] + 30, box["y"] + box["height"] / 2)
                    return

    def title(self):
        return self.page.title()

    def html(self):
        return self.page.content()

    def js_fetch(self, url):
        return self.page.evaluate(FETCH_JS, url)

    def cookies(self):
        return {c["name"]: c["value"] for c in self.page.context.cookies()}

    def ua(self):
        return self.page.evaluate("navigator.userAgent")

    def screenshot(self, path):
        self.page.screenshot(path=str(path))


class SbDriver:
    """SeleniumBase in UC mode."""

    def __init__(self, sb):
        self.sb = sb

    def open(self, url):
        self.sb.uc_open_with_reconnect(url, 4)

    def solve(self):
        self.sb.uc_gui_click_captcha()

    def title(self):
        return self.sb.get_title()

    def html(self):
        return self.sb.get_page_source()

    def js_fetch(self, url):
        js = "const done = arguments[arguments.length - 1]; (" + FETCH_JS + ")(arguments[0]).then(done);"
        self.sb.driver.set_script_timeout(60)
        return self.sb.driver.execute_async_script(js, url)

    def cookies(self):
        return {c["name"]: c["value"] for c in self.sb.get_cookies()}

    def ua(self):
        return self.sb.get_user_agent()

    def screenshot(self, path):
        self.sb.save_screenshot(str(path))


def wait_passed(d) -> bool:
    end = time.time() + WAIT_S
    while True:
        try:
            if not challenged(d.title(), d.html()):
                return True
        except Exception:  # page navigating after the challenge cleared
            pass
        if time.time() > end:
            return False
        try:
            d.solve()
        except Exception as e:
            print("solve:", repr(e)[:200], file=sys.stderr)
        time.sleep(4)


def probe(d, r: dict, impersonate: str):
    t0 = time.time()
    d.open(START)
    r["home_passed"] = wait_passed(d)
    r["home_seconds"] = round(time.time() - t0, 1)
    r["home_title"] = d.title()
    if not r["home_passed"]:
        return
    details = re.findall(r'href="([^"]*/Details/\d+/[^"]+)"', d.html())
    if not details:
        d.open(SEARCH)
        r["search_passed"] = wait_passed(d)
        details = re.findall(r'href="([^"]*/Details/\d+/[^"]+)"', d.html())
    if not details:
        r["note"] = "no /Details/ link found"
        return
    detail = urljoin(BASE, details[0])
    r["detail_url"] = detail
    d.open(detail)
    r["detail_passed"] = wait_passed(d)
    pdfs = re.findall(r'href="([^"]*/Download/[^"]+)"', d.html())
    if not pdfs:
        r["note"] = "no /Download/ link on the detail page"
        return
    pdf = urljoin(BASE, pdfs[0].replace("&amp;", "&"))
    r["pdf_url"] = pdf
    r["pdf_in_browser"] = d.js_fetch(pdf)

    # browser once, plain HTTP after: cf_clearance is bound to IP + user agent (+ TLS family)
    from curl_cffi import requests as cr

    s = cr.Session(impersonate=impersonate)
    s.headers["User-Agent"] = d.ua()
    for k, v in d.cookies().items():
        s.cookies.set(k, v, domain=".bpk.go.id")
    r["cookies"] = sorted(d.cookies())
    reuse = {}
    for name, url in (("detail", detail), ("pdf", pdf)):
        try:
            resp = s.get(url, timeout=60)
            reuse[name] = {"status": resp.status_code, "type": resp.headers.get("content-type"),
                           "bytes": len(resp.content), "head": resp.content[:5].decode("latin-1")}
        except Exception as e:
            reuse[name] = {"error": repr(e)[:200]}
    r["cookie_reuse"] = reuse


def main():
    tool, out = sys.argv[1], Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    r = {"tool": tool}
    t0 = time.time()
    try:
        if tool == "seleniumbase":
            from seleniumbase import SB

            with SB(uc=True, xvfb=True, proxy=PROXY.split('//')[-1] if PROXY else None) as sb:
                d = SbDriver(sb)
                try:
                    probe(d, r, "chrome")
                finally:
                    d.screenshot(out / f"{tool}.png")
        elif tool == "scrapling":
            from scrapling.fetchers import StealthyFetcher

            def action(page):
                d = PwDriver(page)
                try:
                    probe(d, r, "chrome")
                except Exception as e:
                    r["error"] = repr(e)[:500]
                finally:
                    d.screenshot(out / f"{tool}.png")
                return page

            StealthyFetcher.fetch(START, headless=False, real_chrome=True, solve_cloudflare=True,
                                  timeout=90_000, page_action=action, proxy=PROXY)
        elif tool == "camoufox":
            from camoufox.sync_api import Camoufox

            with Camoufox(headless="virtual", humanize=True, proxy={"server": PROXY} if PROXY else None) as browser:
                d = PwDriver(browser.new_page(), click_checkbox=True)
                try:
                    probe(d, r, "firefox")
                finally:
                    d.screenshot(out / f"{tool}.png")
        elif tool == "playwright":
            from playwright.sync_api import sync_playwright

            with sync_playwright() as p:
                browser = p.chromium.launch(proxy={"server": PROXY} if PROXY else None)
                d = PwDriver(browser.new_page())
                try:
                    probe(d, r, "chrome")
                finally:
                    d.screenshot(out / f"{tool}.png")
                    browser.close()
        else:
            raise SystemExit(f"unknown tool {tool}")
    except Exception as e:
        r["error"] = repr(e)[:500]
    r["total_seconds"] = round(time.time() - t0, 1)
    line = json.dumps(r, ensure_ascii=False)
    print(line)
    (out / f"{tool}.json").write_text(line + "\n")


if __name__ == "__main__":
    main()
