"""Save sample pages from peraturan.bpk.go.id so the importer can be written against real HTML.

    python explore.py <outdir>

Clears the Cloudflare check once with Scrapling, then fetches with curl_cffi (same cookies and
user agent). Saves each page as <outdir>/<n>.html plus index.json (url, status, links found).
For listing pages it also saves the first few detail pages. PDFs are not saved: only their
links and response headers.
"""

import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import urljoin

BASE = "https://peraturan.bpk.go.id"
PAGES = [
    "/robots.txt",
    "/sitemap.xml",
    "/",
    "/Search",
    "/Search?jenis=8",
    "/Search?jenis=8&p=2",
    "/Search?keywords=pertambangan+mineral+dan+batubara",
    "/Search?keywords=&tentang=&nomor=4&tahun=2009&jenis=8",
    "/Subjek",
    "/Jenis",
]
DETAILS_PER_LISTING = 2
DELAY = 3


def clearance():
    from scrapling.fetchers import StealthyFetcher

    got = {}

    def grab(page):
        got["cookies"] = {c["name"]: c["value"] for c in page.context.cookies()}
        got["ua"] = page.evaluate("navigator.userAgent")
        return page

    StealthyFetcher.fetch(BASE + "/", headless=False, real_chrome=True, solve_cloudflare=True,
                          timeout=120_000, page_action=grab)
    return got


def main():
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    from curl_cffi import requests as cr

    t0 = time.time()
    c = clearance()
    print(f"clearance in {time.time() - t0:.0f}s, cookies: {sorted(c['cookies'])}", flush=True)
    s = cr.Session(impersonate="chrome")
    s.headers["User-Agent"] = c["ua"]
    for k, v in c["cookies"].items():
        s.cookies.set(k, v, domain=".bpk.go.id")

    index, queue, seen = [], list(PAGES), set()
    while queue:
        path = queue.pop(0)
        url = urljoin(BASE, path)
        if url in seen:
            continue
        seen.add(url)
        time.sleep(DELAY)
        try:
            r = s.get(url, timeout=60)
        except Exception as e:  # noqa: BLE001
            index.append({"url": url, "error": repr(e)[:200]})
            continue
        n = len(index)
        body = r.text if "pdf" not in (r.headers.get("content-type") or "") else ""
        (out / f"{n:02d}.html").write_text(body)
        details = list(dict.fromkeys(re.findall(r'href="([^"]*/Details/\d+/[^"]+)"', body)))
        downloads = list(dict.fromkeys(re.findall(r'href="([^"]*/Download/[^"]+)"', body)))
        index.append({"n": n, "url": url, "status": r.status_code,
                      "type": r.headers.get("content-type"), "bytes": len(r.content),
                      "details": details[:20], "downloads": downloads[:20]})
        print(n, r.status_code, url, len(details), "details", len(downloads), "downloads", flush=True)
        if "/Details/" not in url:
            queue += details[:DETAILS_PER_LISTING]
        for d in downloads[:2]:                   # headers only: what a download looks like
            time.sleep(DELAY)
            h = s.get(urljoin(BASE, d.replace("&amp;", "&")), timeout=120, stream=True)
            index[-1].setdefault("download_heads", []).append(
                {"url": d, "status": h.status_code, "headers": dict(h.headers)})
            h.close()
    (out / "index.json").write_text(json.dumps(index, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
