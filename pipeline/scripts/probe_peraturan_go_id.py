"""Probe peraturan.go.id through Indonesian proxies, read-only: which free proxies reach it, how
complete its listing is against our records, and whether its PDFs carry a text layer.

    uv run --with socksio python scripts/probe_peraturan_go_id.py [--sample N] [--out DIR]

peraturan.go.id answers Indonesian IPs only (docs/sources.md). The proxies come from
ProxyScrape's free list for Indonesia; TLS is always verified, nothing but public pages is
requested, and requests keep the importer's 2-second spacing. Writes report.md and
probe.json to DIR (default: the current folder). Nothing in data/ is changed.
"""

from __future__ import annotations

import hashlib
import json
import random
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import httpx
import yaml

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "src"))

from hukum_rapih import USER_AGENT

DATA = HERE.parent.parent / "data"
SITE = "https://peraturan.go.id"
PROXY_LIST = ("https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies"
              "&country=id&proxy_format=protocolipport&format=text")
DELAY = 2.0


def reaches(proxy: str) -> float | None:
    """Seconds the site's front page took through ``proxy``, or None."""
    start = time.monotonic()
    try:
        with httpx.Client(proxy=proxy, timeout=12, verify=True, http2=False,
                          headers={"User-Agent": USER_AGENT}) as c:
            r = c.get(SITE + "/")
        return time.monotonic() - start if r.status_code == 200 and "peraturan" in r.text.lower() else None
    except Exception:  # noqa: BLE001 - a dead proxy is the common case
        return None


class Rotating:
    """GETs through the working proxies, fastest first, moving on when one fails."""

    def __init__(self, proxies: list[str]):
        self.proxies, self.i, self.last = proxies, 0, 0.0

    def get(self, path: str) -> httpx.Response | None:
        for _ in range(len(self.proxies) * 2):
            wait = DELAY - (time.monotonic() - self.last)
            if wait > 0:
                time.sleep(wait)
            self.last = time.monotonic()
            proxy = self.proxies[self.i % len(self.proxies)]
            try:
                with httpx.Client(proxy=proxy, timeout=httpx.Timeout(20, read=120), verify=True,
                                  http2=False, follow_redirects=True,
                                  headers={"User-Agent": USER_AGENT}) as c:
                    r = c.get(SITE + path if path.startswith("/") else path)
                if r.status_code == 200:
                    return r
            except Exception:  # noqa: BLE001
                pass
            self.i += 1
        return None


def listing(client: Rotating, jenis: str) -> tuple[set[str], int, bool]:
    """Ids on the site's listing of ``jenis``, pages read, and whether the walk finished."""
    ids, page = set(), 1
    while True:
        r = client.get(f"/{jenis}?page={page}")
        if r is None:
            return ids, page - 1, False
        found = re.findall(rf'href="/id/{jenis}-no-([0-9a-z]+)-tahun-(\d{{4}})"', r.text)
        if not found:
            return ids, page - 1, True
        ids |= {f"{jenis}_{n}_{y}" for n, y in found}
        page += 1


def ours(jenis: str) -> dict[str, dict]:
    out = {}
    for p in (DATA / "peraturan" / jenis).glob("*/*/*.yaml"):
        out[p.stem] = yaml.safe_load(p.read_text())
    return out


def known_hashes() -> set[str]:
    path = DATA / "sources" / "manifests" / "peraturan.go.id.jsonl"
    return {json.loads(line)["sha256"] for line in path.read_text().splitlines() if line.strip()}


def text_layer(pdf: bytes) -> tuple[int, float]:
    """Pages, and characters of text per page in the PDF's own text layer (no OCR)."""
    import pymupdf

    doc = pymupdf.open(stream=pdf, filetype="pdf")
    chars = sum(len(page.get_text().strip()) for page in doc)
    return doc.page_count, chars / max(doc.page_count, 1)


def sample_pdfs(client: Rotating, records: dict[str, dict], ids: list[str]) -> list[dict]:
    hashes, rows = known_hashes(), []
    for law in ids:
        jenis, nomor, tahun = law.split("_")
        r = client.get(f"/id/{jenis}-no-{nomor}-tahun-{tahun}")
        pdf = re.search(r'href="(/files/[^"]+\.pdf)"', r.text, re.IGNORECASE) if r else None
        got = client.get(pdf[1]) if pdf else None
        row = {"id": law, "bpk_ocr": bool(_text_version(records[law]).get("ocr"))}
        if got is None or not got.content.startswith(b"%PDF"):
            row["pdf"] = "not reached" if r is None else ("no PDF link" if not pdf else "download failed")
        else:
            pages, per_page = text_layer(got.content)
            sha = hashlib.sha256(got.content).hexdigest()
            row |= {"pdf": pdf[1], "pages": pages, "chars_per_page": round(per_page),
                    "sha256_known": sha in hashes}
        rows.append(row)
    return rows


def _text_version(rec: dict) -> dict:
    return next((v for v in rec.get("versions") or [] if v.get("text")), {})


def main(argv: list[str]) -> int:
    sample = int(argv[argv.index("--sample") + 1]) if "--sample" in argv else 20
    out = Path(argv[argv.index("--out") + 1]) if "--out" in argv else Path(".")
    out.mkdir(parents=True, exist_ok=True)

    listed = [p.strip() for p in httpx.get(PROXY_LIST, timeout=30).text.splitlines() if "://" in p]
    with ThreadPoolExecutor(40) as pool:
        timed = list(zip(listed, pool.map(reaches, listed)))
    working = [p for p, t in sorted((x for x in timed if x[1] is not None), key=lambda x: x[1])]
    report = {"proxies_listed": len(listed), "proxies_working": len(working),
              "working_by_protocol": {k: sum(p.startswith(k) for p in working) for k in ("http", "socks4", "socks5")}}
    lines = ["# peraturan.go.id through Indonesian proxies", "",
             f"Proxies listed: {len(listed)}; reaching the site: {len(working)} "
             f"({report['working_by_protocol']})", ""]
    if not working:
        (out / "report.md").write_text("\n".join(lines + ["No proxy reached the site."]) + "\n")
        (out / "probe.json").write_text(json.dumps(report, indent=1))
        print("\n".join(lines))
        return 1

    client = Rotating(working)
    lines += ["| Type | On the site | Ours | Both | Only the site | Only ours | Pages read | Walk complete |",
              "|---|---:|---:|---:|---:|---:|---:|---|"]
    records: dict[str, dict] = {}
    for jenis in ("uu", "perppu"):
        site, pages, complete = listing(client, jenis)
        mine = ours(jenis)
        records |= mine
        both = site & set(mine)
        report[jenis] = {"site": len(site), "ours": len(mine), "both": len(both),
                         "only_site": sorted(site - set(mine)), "only_ours": sorted(set(mine) - site),
                         "pages": pages, "complete": complete}
        lines.append(f"| {jenis} | {len(site)} | {len(mine)} | {len(both)} | {len(site - set(mine))} "
                     f"| {len(set(mine) - site)} | {pages} | {complete} |")

    ocr = [k for k, r in records.items() if _text_version(r).get("ocr")]
    typed = [k for k, r in records.items() if _text_version(r) and not _text_version(r).get("ocr")]
    random.seed(20261128)
    picked = random.sample(ocr, min(sample * 3 // 4, len(ocr))) + random.sample(typed, min(sample // 4, len(typed)))
    rows = sample_pdfs(client, records, picked)
    report["sample"] = rows
    lines += ["", "## Sample PDFs (mostly laws whose BPK text needed OCR)", "",
              "| Law | BPK text OCR'd | PDF | Pages | Text chars per page | sha256 already in our manifest |",
              "|---|---|---|---:|---:|---|"]
    lines += [f"| {r['id']} | {r['bpk_ocr']} | {r['pdf']} | {r.get('pages', '')} | "
              f"{r.get('chars_per_page', '')} | {r.get('sha256_known', '')} |" for r in rows]
    (out / "report.md").write_text("\n".join(lines) + "\n")
    (out / "probe.json").write_text(json.dumps(report, indent=1))
    print("\n".join(lines))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
