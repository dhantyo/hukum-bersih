"""peraturan.go.id: listing pages -> detail metadata -> PDF -> Bluebell text in data/.

Writes, per regulation (docs/NAMING.md):
    data/peraturan/<jenis>/<tahun>/<jenis>_<nomor>_<tahun>/<id>.yaml
    data/peraturan/<jenis>/<tahun>/<id>/<id>_<date>.txt         (when the PDF parses)
and a manifest line in data/sources/manifests/peraturan.go.id.jsonl. PDFs are not kept.
Already imported regulations are skipped, so runs resume. No archive.org upload here (keys
live in GitHub secrets); the fetch workflow can archive later from the manifest.
"""

from __future__ import annotations

import html
import json
import re
import tempfile
import time
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path

import httpx
import yaml

from .. import USER_AGENT
from ..manifest import entry_for_file, manifest_path

BASE = "https://peraturan.go.id"
BULAN = {b: i for i, b in enumerate(
    ["januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus", "september",
     "oktober", "november", "desember"], start=1)}
STATUS = {"berlaku": "berlaku", "dicabut": "dicabut", "diubah": "diubah",
          "tidak berlaku": "tidak_berlaku"}
JENIS_TITLE = {"uu": "Undang-Undang", "pp": "Peraturan Pemerintah",
               "perpres": "Peraturan Presiden", "perppu": "Peraturan Pemerintah Pengganti Undang-Undang"}


@dataclass
class Listing:
    detail: str   # "/id/uu-no-1-tahun-2026"
    pdf: str | None


class Client:
    """Polite client: identifiable, rate-limited, retries with backoff (the site is flaky)."""

    def __init__(self, delay: float = 2.0):
        self.delay = delay
        self.http = httpx.Client(headers={"User-Agent": USER_AGENT}, http2=False,
                                 timeout=httpx.Timeout(60, read=300), follow_redirects=True)
        self._last = 0.0

    def get(self, path: str, retries: int = 6) -> httpx.Response:
        for attempt in range(retries):
            wait = self.delay - (time.monotonic() - self._last)
            if wait > 0:
                time.sleep(wait)
            self._last = time.monotonic()
            try:
                r = self.http.get(BASE + path if path.startswith("/") else path)
                if r.status_code < 500:
                    r.raise_for_status()
                    return r
            except httpx.HTTPError:
                pass
            time.sleep(min(300, 10 * 2 ** attempt))
        raise RuntimeError(f"giving up on {path}")


def listings(client: Client, jenis: str) -> Iterator[Listing]:
    page = 1
    while True:
        text = client.get(f"/{jenis}?page={page}").text
        details = list(dict.fromkeys(re.findall(rf'href="(/id/{jenis}-no-[^"#]+)"', text)))
        if not details:
            return
        pdfs = re.findall(r'href="(/files/[^"]+\.pdf)"', text, re.IGNORECASE)
        for d in details:
            slug = d.rsplit("/", 1)[-1]
            yield Listing(d, next((p for p in pdfs if slug in p), None))
        page += 1


def detail(client: Client, path: str) -> dict[str, str]:
    text = client.get(path).text
    meta = {}
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", text, re.DOTALL):
        cells = [re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", c))).strip()
                 for c in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", row, re.DOTALL)]
        if len(cells) == 2 and cells[0]:
            meta[cells[0]] = cells[1]
    pdfs = re.findall(r'href="(/files/[^"]+\.pdf)"', text, re.IGNORECASE)
    if pdfs:
        meta["_pdf"] = pdfs[0]
    return meta


def tanggal_iso(text: str) -> str | None:
    m = re.match(r"(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})", text or "")
    if not m or m[2].lower() not in BULAN:
        return None
    iso = f"{m[3]}-{BULAN[m[2].lower()]:02d}-{int(m[1]):02d}"
    return None if iso == "1970-01-01" else iso     # an empty date in their database, not a date


def import_one(client: Client, item: Listing, jenis: str, data_dir: Path) -> str:
    from ..naming import validate_id

    m = re.search(rf"{jenis}-no-([0-9a-z]+)-tahun-(\d{{4}})", item.detail)
    if not m:
        return f"skip {item.detail}: unrecognised"
    nomor, tahun = m[1], m[2]
    work = validate_id(f"{jenis}_{nomor}_{tahun}")
    folder = data_dir / "peraturan" / jenis / tahun / work
    record = folder / f"{work}.yaml"
    if record.exists():
        return f"skip {work}: already imported"

    meta = detail(client, item.detail)
    pdf_path = meta.get("_pdf") or item.pdf
    date = tanggal_iso(meta.get("Ditetapkan Tanggal", ""))
    rec: dict = {
        "id": work,
        "akn": f"/akn/id/act/{jenis}/{tahun}/{nomor}",
        "type": jenis,
        "number": nomor,
        "year": int(tahun),
        "title": f"{JENIS_TITLE.get(jenis, jenis.upper())} Nomor {nomor} Tahun {tahun}"
                 + (f" tentang {meta['Tentang'].title()}" if meta.get("Tentang") else ""),
        "tentang": meta.get("Tentang"),
        "short_name": None,
        "status": STATUS.get(meta.get("Status", "").lower(), meta.get("Status") or None),
        "tanggal_penetapan": date,
        "tempat_penetapan": meta.get("Tempat Penetapan"),
        "pejabat_penetapan": meta.get("Pejabat yang Menetapkan"),
        "pemrakarsa": meta.get("Pemrakarsa"),
        "source_url": BASE + item.detail,
        "source_pdf_url": BASE + pdf_path if pdf_path else None,
        "relationships": {"amends": [], "amended_by": [], "revokes": [], "revoked_by": []},
        "versions": [],
    }
    note = convert(client, rec, folder, data_dir) if pdf_path else "no PDF"
    folder.mkdir(parents=True, exist_ok=True)
    record.write_text(yaml.safe_dump(rec, allow_unicode=True, sort_keys=False))
    return f"ok   {work}: {note}"


def convert(client: Client, rec: dict, folder: Path, data_dir: Path) -> str:
    """Download the record's PDF, record it in the manifest, and (re)write its text version.
    Updates ``rec`` in place (versions, pdf_sha256, pdf_quality, parse_error)."""
    url = rec["source_pdf_url"]
    pdf_path = url.removeprefix(BASE)
    with tempfile.TemporaryDirectory() as tmp:
        pdf = Path(tmp) / "doc.pdf"
        pdf.write_bytes(client.get(pdf_path).content)      # raises on failure: nothing changed
        entry = entry_for_file(pdf, url, None, rec["id"], pdf_path.rsplit("/", 1)[-1])
        if rec.get("pdf_sha256") != entry.sha256:          # new or changed upstream
            rec["pdf_sha256"] = entry.sha256
            manifest = manifest_path(data_dir, url)
            manifest.parent.mkdir(parents=True, exist_ok=True)
            with manifest.open("a") as f:
                f.write(json.dumps(entry.to_dict(), ensure_ascii=False) + "\n")
        return convert_pdf(pdf, rec, folder, source="peraturan.go.id")


def convert_pdf(pdf: Path, rec: dict, folder: Path, source: str) -> str:
    """Parse a local PDF of the record and (re)write its text version. A failed parse never
    costs the text we already have (2026-11-21: an outage deleted three texts); the new text
    replaces the old one only once it exists. ``source``: where the PDF came from."""
    from ..akn.bluebell import to_bluebell
    from ..akn.build import to_akn
    from ..manifest import sha256_file
    from ..pdf.structure import PARSER_VERSION, parse_pdf

    work, date = rec["id"], rec.get("tanggal_penetapan")
    old = [v for v in rec.get("versions") or [] if v.get("text")]

    def replace_versions(new: list[dict]) -> None:
        for v in old:
            if not any(n["text"] == v["text"] for n in new):
                (folder / v["text"]).unlink(missing_ok=True)
        rec["versions"] = new
        rec.pop("pdf_quality", None)
        rec.pop("parse_error", None)
        rec.pop("reparse_error", None)

    try:
        doc = parse_pdf(pdf)
        if doc.pasal_count == 0:
            if old:                                        # keep the text we have
                rec["reparse_error"] = f"v{PARSER_VERSION}: no pasal found"
                return "kept old text (new parse found no pasal)"
            rec.pop("parse_error", None)
            rec["pdf_quality"] = "image_only_or_unparsed"
            return "no pasal found (scanned PDF?)"
        before = max((v.get("pasal_count") or 0) for v in old) if old else 0
        if doc.pasal_count < before:                       # never replace a text with a poorer one
            rec["reparse_error"] = f"v{PARSER_VERSION}: {doc.pasal_count} pasal, stored text has {before}"
            return f"kept old text (new parse has {doc.pasal_count} pasal, stored {before})"
        text = to_bluebell(doc)
        to_akn(text, rec["akn"], "act")                    # validates structure and markup
        version = f"{work}_{date or rec['year']}"
        folder.mkdir(parents=True, exist_ok=True)
        (folder / f"{version}.txt").write_text(text)
        replace_versions([{
            "id": version, "kind": "asli", "source": "official",
            "date": date, "date_basis": "tanggal_penetapan",
            "text": f"{version}.txt", "pasal_count": doc.pasal_count,
            "parser_version": PARSER_VERSION,
            "pdf_source": source, "pdf_sha256": sha256_file(pdf),
            **({"ocr": True} if any(w.startswith("ocr:") for w in doc.warnings) else {}),
        }])
        return f"{doc.pasal_count} pasal"
    except Exception as e:  # noqa: BLE001 - record and move on; never guess
        err = f"{type(e).__name__}: {str(e)[:200]}"
        if old:
            rec["reparse_error"] = f"v{PARSER_VERSION}: {err}"
            return f"kept old text (parse error: {err[:80]})"
        rec["parse_error"] = err
        return f"parse error: {err[:80]}"


def reparse(client: Client, jenis: str, data_dir: Path,
            only: set[str] | None = None) -> Iterator[str]:
    """Re-convert imported regulations whose text came from an older parser version (or
    that have no text yet), from their PDFs. Metadata is kept. ``only``: just these ids,
    first (so a sample can be redone before the whole collection)."""
    from ..pdf.structure import PARSER_VERSION

    records = sorted((data_dir / "peraturan" / jenis).glob("*/*/*.yaml"))
    if only:
        records = [r for r in records if r.stem in only]
    for record in records:
        rec = yaml.safe_load(record.read_text())
        versions = rec.get("versions") or []
        if versions and all(v.get("parser_version") == PARSER_VERSION for v in versions):
            continue
        if not rec.get("source_pdf_url"):
            continue
        if str(rec.get("reparse_error", "")).startswith(f"v{PARSER_VERSION}:"):
            continue                                      # tried with this parser; old text kept
        if not versions and rec.get("parser_version_tried") == PARSER_VERSION:
            continue                                      # scanned: OCR needed, not a re-parse
        try:
            note = convert(client, rec, record.parent, data_dir)
        except Exception as e:  # noqa: BLE001 - keep going; resumable
            yield f"FAIL {rec['id']}: {e}"
            continue
        if not rec["versions"]:
            rec["parser_version_tried"] = PARSER_VERSION
        record.write_text(yaml.safe_dump(rec, allow_unicode=True, sort_keys=False))
        yield f"ok   {rec['id']}: reparsed, {note}"
