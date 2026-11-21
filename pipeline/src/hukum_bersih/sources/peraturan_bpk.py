"""peraturan.bpk.go.id (Database Peraturan JDIH BPK): listing -> detail -> PDFs -> archive.org
and the manifest -> text, the main source for regulations since 2026-11-21.

Per regulation (docs/NAMING.md):
    data/peraturan/<jenis>/<tahun>/<id>/<id>.yaml        record (created, or updated)
    data/peraturan/<jenis>/<tahun>/<id>/<version>.txt    text, when the record has none yet
and per PDF one line in data/sources/manifests/peraturan.bpk.go.id.jsonl. Every PDF is
archived on archive.org as soon as it is downloaded (nothing is downloaded and thrown away).

Records imported earlier from peraturan.go.id keep their text: the BPK PDF is archived and
parsed for comparison only (``bpk.pasal_count``); switching texts is a separate decision.
Their peraturan.go.id links move to ``other_sources``. Metadata already in a record is never
overwritten with a blank, and a differing date is recorded next to ours, not swapped in.

The site sits behind Cloudflare; see bpk_session.py.
"""

from __future__ import annotations

import html
import json
import re
import tempfile
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import unquote

import yaml

from .bpk_session import BASE

SOURCE = "peraturan.bpk.go.id"
JENIS_ID = {"uu": 8, "perppu": 9, "pp": 10, "perpres": 11}    # BPK's "jenis" filter values
BENTUK = {"uu": "uu", "perpu": "perppu", "perppu": "perppu", "pp": "pp", "perpres": "perpres"}
JENIS_TITLE = {"uu": "Undang-Undang", "perppu": "Peraturan Pemerintah Pengganti Undang-Undang",
               "pp": "Peraturan Pemerintah", "perpres": "Peraturan Presiden"}
STATUS = {"berlaku": "berlaku", "tidak berlaku": "tidak_berlaku", "dicabut": "dicabut",
          "diubah": "diubah"}


# ---- parsing -------------------------------------------------------------------------------

def clean(fragment: str) -> str:
    """HTML fragment -> plain text on one line."""
    text = html.unescape(re.sub(r"<[^>]+>", " ", fragment))
    return re.sub(r"\s+", " ", text).strip()


@dataclass(frozen=True)
class Listing:
    path: str      # /Details/38578/uu-no-4-tahun-2009
    bpk_id: int


def parse_listing(text: str) -> list[Listing]:
    # each result's heading link ("Undang-undang (UU) Nomor 5 Tahun 2026"); the status lines
    # under a result link to related regulations, which are not results themselves
    paths = dict.fromkeys(re.findall(
        r'<a class="text-gray-600 text-decoration-none" href="(/Details/\d+/[^"#?]+)"', text))
    return [Listing(p, int(p.split("/")[2])) for p in paths]


def last_page(text: str) -> int:
    pages = [int(p) for p in re.findall(r"[?&](?:amp;)?p=(\d+)", text)]
    return max(pages, default=1)


def cite_to_id(citation: str) -> str | None:
    """'UU No. 2 Tahun 2025' -> 'uu_2_2025'; 'PERPU No. 2 Tahun 2022' -> 'perppu_2_2022'."""
    m = re.match(r"\s*(UU|PERPU|PERPPU|PP|PERPRES)\s+No\.?\s*([0-9]+[A-Za-z]?)\s+Tahun\s+(\d{4})\s*$",
                 citation, re.IGNORECASE)
    return f"{BENTUK[m[1].lower()]}_{m[2].lower()}_{m[3]}" if m else None


def _attrs(tag: str) -> dict[str, str]:
    return {k: html.unescape(v) for k, v in re.findall(r'([\w-]+)="([^"]*)"', tag)}


def parse_detail(text: str) -> dict:
    """Detail page -> {'meta': {label: value}, 'files', 'uji_materi', 'status_peraturan'}."""
    meta = {}
    for label, value in re.findall(
        r'<div class="col-lg-3 fw-bold">(.*?)</div>\s*<div class="col-lg-9">(.*?)</div>', text, re.DOTALL
    ):
        meta[clean(label)] = clean(value)

    files = []
    for tag in re.findall(r"<a\b[^>]*>", text):
        a = _attrs(tag)
        if a.get("data-kategori") == "Peraturan" and a.get("href", "").startswith("/Download/"):
            files.append({"url": BASE + a["href"], "bpk_file_id": int(a["data-id"]),
                          "filename": unquote(a["href"].rsplit("/", 1)[-1])})

    uji_materi = []
    for tag, putusan, rest in re.findall(
        r'(<a\b[^>]*data-kategori="UjiMateri"[^>]*>)(.*?)</a>(.*?)(?=data-kategori="UjiMateri"|UJI MATERI|$)',
        text, re.DOTALL,
    ):
        amar = re.search(r"<span>(.*?)</span>", rest, re.DOTALL)
        uji_materi.append({"putusan": clean(putusan), "url": BASE + _attrs(tag)["href"],
                           "amar": clean(amar[1]) if amar else None})

    status: dict[str, list[dict]] = {}
    block = text[text.find("STATUS <span"):]
    block = block[: block.find("ABSTRAK <span")] if "ABSTRAK <span" in block else block
    for heading, items in re.findall(
        r'<div class="col-12 fw-semibold bg-light-primary p-4">\s*(.*?)\s*</div>.*?<ol[^>]*>(.*?)</ol>',
        block, re.DOTALL,
    ):
        entries = []
        for li in re.findall(r"<li[^>]*>(.*?)</li>", items, re.DOTALL):
            link = re.search(r'<a[^>]*href="(/Details/[^"]+)"[^>]*>(.*?)</a>', li, re.DOTALL)
            note = re.search(r"<br\s*/?>\s*<span>(.*?)</span>", li, re.DOTALL)
            body = re.sub(r"<br\s*/?>\s*<span>.*?</span>", "", li, flags=re.DOTALL)
            if link:
                citation = clean(link[2])
                tentang = clean(body.split("</a>", 1)[1]).removeprefix("tentang").strip()
                entries.append({"id": cite_to_id(citation), "citation": citation,
                                "tentang": tentang or None, "url": BASE + link[1],
                                "note": (clean(note[1]) or None) if note else None})
            else:
                entries.append({"id": None, "citation": clean(body), "tentang": None,
                                "url": None, "note": (clean(note[1]) or None) if note else None})
        status[clean(heading).rstrip(" :")] = entries
    return {"meta": meta, "files": files, "uji_materi": uji_materi, "status_peraturan": status}


def work_id(meta: dict, jenis: str) -> str:
    from ..naming import validate_id

    bentuk = BENTUK.get(meta.get("Bentuk Singkat", "").lower(), jenis)
    nomor = re.sub(r"\s+", "", meta.get("Nomor", "")).lower()
    return validate_id(f"{bentuk}_{nomor}_{meta.get('Tahun', '')}")


# ---- records -------------------------------------------------------------------------------

def update_record(rec: dict | None, d: dict, jenis: str, detail_url: str) -> tuple[dict, list[str]]:
    """Merge a parsed detail page into a record (new if ``rec`` is None). Returns the record
    and notes for the log (e.g. dates that differ from ours)."""
    from .peraturan_go_id import tanggal_iso

    meta, notes = d["meta"], []
    work = work_id(meta, jenis)
    w_jenis, nomor, tahun = work.split("_")
    judul = meta.get("Judul", "")
    tentang = judul.split(" tentang ", 1)[1].strip() if " tentang " in judul else None
    if rec is None:
        rec = {
            "id": work, "akn": f"/akn/id/act/{w_jenis}/{tahun}/{nomor}", "type": w_jenis,
            "number": nomor, "year": int(tahun),
            "title": f"{JENIS_TITLE.get(w_jenis, w_jenis.upper())} Nomor {nomor.upper()} Tahun {tahun}"
                     + (f" tentang {tentang}" if tentang else ""),
            "tentang": tentang, "short_name": None, "status": None,
            "tanggal_penetapan": None, "tempat_penetapan": None, "pejabat_penetapan": None,
            "pemrakarsa": None, "source_url": None, "source_pdf_url": None,
            "relationships": {"amends": [], "amended_by": [], "revokes": [], "revoked_by": []},
            "versions": [],
        }
    elif rec["id"] != work:
        raise ValueError(f"BPK page is {work}, record is {rec['id']}")

    def fill(key: str, value) -> None:            # never blank out what we have
        if value and not rec.get(key):
            rec[key] = value

    fill("tentang", tentang)
    fill("tempat_penetapan", meta.get("Tempat Penetapan"))
    penetapan = tanggal_iso(meta.get("Tanggal Penetapan", ""))
    if penetapan and rec.get("tanggal_penetapan") and str(rec["tanggal_penetapan"]) != penetapan:
        rec["tanggal_penetapan_bpk"] = penetapan
        notes.append(f"tanggal penetapan differs: ours {rec['tanggal_penetapan']}, BPK {penetapan}")
    fill("tanggal_penetapan", penetapan)
    for key, label in (("tanggal_pengundangan", "Tanggal Pengundangan"),
                       ("tanggal_berlaku", "Tanggal Berlaku")):
        if iso := tanggal_iso(meta.get(label, "")):
            rec[key] = iso
    for key, label in (("lembaran_negara", "Sumber"), ("subjek", "Subjek")):
        if meta.get(label):
            rec[key] = meta[label]
    if status := STATUS.get(meta.get("Status", "").lower()):
        rec["status"] = status

    # BPK becomes the primary source; earlier sources are kept
    old = {"source_url": rec.get("source_url"), "source_pdf_url": rec.get("source_pdf_url")}
    if old["source_url"] and SOURCE not in old["source_url"]:
        others = rec.setdefault("other_sources", [])
        if old not in others:
            others.append(old)
    rec["source_url"] = detail_url
    rec["source_pdf_url"] = d["files"][0]["url"] if d["files"] else None
    bpk = rec.setdefault("bpk", {})
    bpk["id"] = int(detail_url.split("/")[4])
    old_files = {f["url"]: f for f in bpk.get("files", [])}
    bpk["files"] = [{**old_files.get(f["url"], {}), **f} for f in d["files"]]
    bpk["status_peraturan"] = d["status_peraturan"] or None
    rec["uji_materi"] = d["uji_materi"] or None
    return rec, notes


def record_path(data_dir: Path, work: str) -> Path:
    jenis, _, tahun = work.split("_")
    return data_dir / "peraturan" / jenis / tahun / work / f"{work}.yaml"


def done(rec: dict) -> bool:
    """Every BPK file of the record is downloaded and archived (or recorded, without keys)."""
    files = (rec.get("bpk") or {}).get("files") or []
    return bool(files) and all(f.get("sha256") for f in files)


# ---- archive.org ---------------------------------------------------------------------------

def archived_files(data_dir: Path) -> tuple[dict[str, str], dict[str, set[str]]]:
    """From the manifests: sha256 -> archive_url, and archive.org item -> file names taken."""
    from ..manifest import records

    by_sha, taken = {}, {}
    for r in records(data_dir):
        url = r.get("archive_url")
        if not url:
            continue
        by_sha.setdefault(r["sha256"], url)
        m = re.match(r"https://archive\.org/download/([^/]+)/(.+)$", url)
        if m:
            taken.setdefault(m[1], set()).add(m[2])
    return by_sha, taken


def file_ids(version: str, item: str, n: int, taken: set[str]) -> tuple[str, str]:
    """(doc id, file name) for the ``n``-th file of a version (1-based): the version id, then
    ``_2``, ``_3`` … (docs/NAMING.md); a name already used in the item by another file moves on."""
    k = n
    while True:
        doc_id = version if k == 1 else f"{version}_{k}"
        if f"{doc_id}.pdf" not in taken:
            return doc_id, f"{doc_id}.pdf"
        k += 1


# ---- import --------------------------------------------------------------------------------

def listings(session, jenis: str) -> Iterator[Listing]:
    page, last = 1, 1
    while page <= last:
        text = session.get(f"/Search?jenis={JENIS_ID[jenis]}&p={page}").text
        last = max(last, last_page(text))
        items = parse_listing(text)
        if not items:
            return
        yield from items
        page += 1


SLUG = {"uu": "uu", "perppu": "perpu", "pp": "pp", "perpres": "perpres"}


def find(session, work: str) -> Listing:
    """BPK detail page of one regulation, via the search form (nomor + tahun + jenis)."""
    jenis, nomor, tahun = work.split("_")
    text = session.get(f"/Search?keywords=&tentang=&nomor={nomor}&tahun={tahun}"
                       f"&jenis={JENIS_ID[jenis]}").text
    want = re.compile(rf"^/Details/\d+/{SLUG[jenis]}-no-{re.escape(nomor)}-tahun-{tahun}(?:-|$)")
    hits = [i for i in parse_listing(text) if want.match(i.path)]
    if len(hits) != 1:
        raise LookupError(f"{work}: {len(hits)} matching results on BPK")
    return hits[0]


def import_one(session, item: Listing, jenis: str, data_dir: Path, known: dict[int, Path],
               do_archive: bool = True, cache: tuple | None = None, no_text: bool = False) -> str:
    """Fetch one detail page, update or create the record, download + archive its PDFs, and
    convert the main PDF when the record has no text (not with ``no_text``: PDFs only, e.g.
    to collect samples while the parser is being fixed). ``known``: bpk id -> record path."""
    from .. import archive
    from ..manifest import entry_for_file, manifest_path
    from ..naming import archive_item
    from ..pdf.structure import PARSER_VERSION, parse_pdf
    from .peraturan_go_id import convert_pdf

    path = known.get(item.bpk_id)
    if path and done(yaml.safe_load(path.read_text())):
        return f"skip {path.stem}: already from BPK"
    detail_url = BASE + item.path
    d = parse_detail(session.get(item.path).text)
    if not d["meta"].get("Nomor"):
        return f"skip {item.path}: no metadata"
    work = work_id(d["meta"], jenis)
    path = record_path(data_dir, work)
    existing = yaml.safe_load(path.read_text()) if path.exists() else None
    rec, notes = update_record(existing, d, jenis, detail_url)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(yaml.safe_dump(rec, allow_unicode=True, sort_keys=False))   # metadata first
    known[item.bpk_id] = path
    if not d["files"]:
        return f"ok   {work}: no PDF on BPK" + "".join(f"; {n}" for n in notes)

    by_sha, taken = cache or archived_files(data_dir)
    texts = [v for v in rec.get("versions") or [] if v.get("text")]
    version = texts[0]["id"] if texts else f"{work}_{rec.get('tanggal_penetapan') or rec['year']}"
    item_id = archive_item(version)
    out = []
    with tempfile.TemporaryDirectory() as tmp:
        main_pdf = None
        for n, f in enumerate(rec["bpk"]["files"], start=1):
            r = session.get(f["url"])
            pdf = Path(tmp) / f"{n}.pdf"
            pdf.write_bytes(r.content)
            if not r.content[:5].startswith(b"%PDF"):
                raise RuntimeError(f"{f['url']}: not a PDF ({r.headers.get('content-type')})")
            entry = entry_for_file(pdf, f["url"], None, None, f["filename"])
            archive_url = by_sha.get(entry.sha256)
            doc_id, repaired = None, None
            if archive_url is None and do_archive:
                doc_id, filename = file_ids(version, item_id, n, taken.setdefault(item_id, set()))
                repaired = archive.upload(pdf, doc_id, filename, f["url"], f["filename"], data_dir,
                                          rec.get("title"))
                archive_url = f"https://archive.org/download/{item_id}/{filename}"
                taken[item_id].add(filename)
                by_sha[entry.sha256] = archive_url
            doc_id = doc_id or (version if n == 1 else f"{version}_{n}")
            entry = entry_for_file(pdf, f["url"], archive_url, doc_id, f["filename"])
            if repaired:
                from dataclasses import replace
                entry = replace(entry, archived_sha256=repaired.sha256, note=repaired.note)
            manifest = manifest_path(data_dir, f["url"])
            manifest.parent.mkdir(parents=True, exist_ok=True)
            with manifest.open("a") as fh:
                fh.write(json.dumps(entry.to_dict(), ensure_ascii=False) + "\n")
            f.update(sha256=entry.sha256, bytes=entry.bytes, archive_url=archive_url)
            main_pdf = main_pdf or pdf
            out.append("archived" if archive_url else "recorded")
        if no_text:
            note = "PDFs only (no text step)"
        elif texts:                                     # keep our text; parse BPK's to compare
            try:
                rec["bpk"]["pasal_count"] = parse_pdf(main_pdf).pasal_count
            except Exception as e:  # noqa: BLE001
                rec["bpk"]["pasal_count"] = None
                notes.append(f"BPK PDF does not parse: {type(e).__name__}")
            rec["bpk"]["parser_version"] = PARSER_VERSION
            note = (f"kept text ({texts[0].get('pasal_count')} pasal; "
                    f"BPK PDF {rec['bpk']['pasal_count']} pasal)")
        else:
            note = convert_pdf(main_pdf, rec, path.parent, source=SOURCE)
    path.write_text(yaml.safe_dump(rec, allow_unicode=True, sort_keys=False))
    return (f"ok   {work}: {len(out)} PDF {'/'.join(sorted(set(out)))}; {note}"
            + "".join(f"; {n}" for n in notes))


def known_records(data_dir: Path) -> dict[int, Path]:
    """bpk id -> record path, for records already linked to BPK."""
    out = {}
    for path in (data_dir / "peraturan").glob("*/*/*/*.yaml"):
        rec = yaml.safe_load(path.read_text())
        if (rec.get("bpk") or {}).get("id"):
            out[int(rec["bpk"]["id"])] = path
    return out
