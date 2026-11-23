"""National regulations from the Hugging Face dataset ``Azzindani/ID_REG_RAG_2611``
(decision 0011): a prototype source for regulations we have no text of yet.

The dataset is a retrieval corpus, not a set of documents: each regulation is cut into
chunks (``bundle/chunks/*.parquet``), and the heading lines of the original Markdown are
not in the chunk text but in ``heading_path`` ("BAB I. › Pasal 1."). A text is rebuilt by
walking the chunks in order and writing each heading when the path first reaches it, then
the chunk's text; the lines go through our own parser (pdf/structure.py) like PDF lines.
So the text is *rebuilt*, and every version says so (``source: dataset``,
``rebuilt_from_chunks``). Known losses, measured on UU 4/2009 against our text from the PDF
(~95% of the words shared): some "Cukup jelas" entries of the Penjelasan and some hyphens
("perundangundangan") are missing; in some documents the Penjelasan heading was lost.

Rules (decision 0011):
- national types only (``TYPES``); regional regulations need an id scheme with the region
  (docs/NAMING.md has none yet) and, per the brief, their own repository;
- a record that already has a text is never touched; a record without one gets the text;
- a document whose type, number or year is unclear is skipped and logged, never guessed;
- several documents for one regulation: the one the dataset rates best is used.

Per regulation (docs/NAMING.md): data/peraturan/<jenis>/<tahun>/<id>/<id>.yaml and
<version>.txt, as the other importers write them.
"""

from __future__ import annotations

import math
import re
from collections.abc import Iterator
from dataclasses import dataclass, field
from pathlib import Path

import yaml

DATASET = "Azzindani/ID_REG_RAG_2611"
HF = "https://huggingface.co"
SOURCE = f"huggingface.co/datasets/{DATASET}"

# the dataset's regulation_type, without spaces and hyphens (it writes both
# "PERATURAN PRESIDEN" and "PERATURANPRESIDEN") -> our jenis (docs/NAMING.md)
TYPES = {
    "UNDANGUNDANG": "uu",
    "PERATURANPEMERINTAHPENGGANTIUNDANGUNDANG": "perppu",
    "PERATURANPEMERINTAH": "pp",
    "PERATURANPRESIDEN": "perpres",
    "KEPUTUSANPRESIDEN": "keppres",
    "INSTRUKSIPRESIDEN": "inpres",
}
# the dataset's own verdict on a document's text (doc_quality.parquet), best first
QUALITY = {"clean": 0, "degraded": 1, "unusable": 2, "absent": 3}
STATUS = {"revoked": "dicabut", "amended": "diubah"}
# types whose full list we already have (from BPK): the dataset only fills in missing texts
COMPLETE_TYPES = ("uu",)      # none_known / partially_revoked: unknown

COLUMNS = ["doc_id", "seq", "part_n", "regulation_type", "enacting_body", "regulation_number",
           "year", "about", "effective_date", "heading_path", "source_title", "source_sha256",
           "chunker", "chunker_version", "profile", "body"]


@dataclass
class Doc:
    doc_id: str
    work: str
    jenis: str
    nomor: str
    tahun: int
    meta: dict
    chunks: list[dict] = field(default_factory=list)
    quality: str = "unknown"
    status: dict = field(default_factory=dict)


# download ------------------------------------------------------------------------------

def download(cache: Path, revision: str = "main") -> tuple[Path, str]:
    """The bundle's chunks, quality and status tables into ``cache`` (about 360 MB), and the
    dataset revision (commit sha) they are from. Files already there are kept."""
    import httpx

    with httpx.Client(follow_redirects=True, timeout=120) as client:
        info = client.get(f"{HF}/api/datasets/{DATASET}/revision/{revision}").raise_for_status().json()
        sha = info["sha"]
        tree = client.get(f"{HF}/api/datasets/{DATASET}/tree/{sha}/bundle/chunks").raise_for_status().json()
        files = [f["path"] for f in tree if f["path"].endswith(".parquet")]
        files += ["bundle/doc_quality.parquet", "bundle/doc_status.parquet"]
        for path in files:
            target = cache / sha / path
            if target.exists():
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            part = target.with_suffix(".part")
            with client.stream("GET", f"{HF}/datasets/{DATASET}/resolve/{sha}/{path}") as r:
                r.raise_for_status()
                with part.open("wb") as out:
                    for block in r.iter_bytes(1 << 20):
                        out.write(block)
            part.rename(target)
    return cache / sha, sha


# reading -------------------------------------------------------------------------------

def jenis_of(row: dict) -> str | None:
    kind = TYPES.get(re.sub(r"[\s-]", "", row.get("regulation_type") or "").upper())
    title = (row.get("source_title") or "").lower()
    # an Undang-Undang Darurat is filed as "UNDANG-UNDANG" (its own type, docs/NAMING.md):
    # "UNDANG-UNDANG DARURAT REPUBLIK INDONESIA NOMOR 6 TAHUN 1956" is not UU 6/1956
    if kind == "uu" and (re.search(r"darurat|(^|_)drt(_|$)", title) or row.get("_darurat")):
        return "uu-drt"
    # a Perppu filed under "PERATURAN PEMERINTAH" (Perpu_4_Tahun_2009: issuer "PENGGANTI UNDANG-UNDANG ...")
    if kind == "pp" and (title.startswith(("perpu", "perppu")) or "PENGGANTI" in (row.get("enacting_body") or "").upper()):
        return "perppu"
    return kind


def work_of(row: dict) -> tuple[str, str, int] | None:
    """(jenis, nomor, tahun), or None when any of them is unclear."""
    jenis = jenis_of(row)
    nomor = str(row.get("regulation_number") or "").strip().lower()
    year = row.get("year")
    if not jenis or not re.fullmatch(r"\d+[a-z]?", nomor) or year is None or math.isnan(year):
        return None
    tahun = int(year)
    if not 1945 <= tahun <= 2100:
        return None
    return jenis, nomor.lstrip("0") or "0", tahun


def load(bundle: Path, log: list[str] | None = None) -> dict[str, Doc]:
    """One Doc per regulation id, national types only, best-rated document first."""
    import pyarrow.parquet as pq

    log = log if log is not None else []
    quality = {r["doc_id"]: r["verdict"] for r in
               pq.read_table(bundle / "bundle/doc_quality.parquet", columns=["doc_id", "verdict"]).to_pylist()}
    status = {r["doc_id"]: r for r in pq.read_table(bundle / "bundle/doc_status.parquet").to_pylist()}
    docs: dict[str, Doc] = {}
    skipped: dict[str, str] = {}
    for part in sorted((bundle / "bundle/chunks").glob("*.parquet")):
        for row in pq.read_table(part, columns=COLUMNS).to_pylist():
            doc = docs.get(row["doc_id"])
            if doc is None:
                if row["doc_id"] in skipped or not jenis_of(row):
                    continue
                w = work_of(row)
                if w is None:
                    skipped[row["doc_id"]] = f"{row.get('source_title')}: unclear type, number or year"
                    continue
                jenis, nomor, tahun = w
                doc = docs[row["doc_id"]] = Doc(
                    row["doc_id"], f"{jenis}_{nomor}_{tahun}", jenis, nomor, tahun,
                    meta={k: row.get(k) for k in ("about", "effective_date", "source_title", "source_sha256",
                                                  "chunker", "chunker_version", "profile", "regulation_type")},
                    quality=quality.get(row["doc_id"], "unknown"),
                    status=status.get(row["doc_id"], {}))
            doc.chunks.append({k: row[k] for k in ("seq", "part_n", "heading_path", "body")})
    log += [f"skip {d}: {why}" for d, why in skipped.items()]

    best: dict[str, Doc] = {}
    for doc in docs.values():
        doc.chunks.sort(key=lambda c: (c["seq"], c["part_n"] or 0))
        head = " ".join((doc.chunks[0]["body"] or "").split()[:4]).upper() if doc.chunks else ""
        if doc.jenis == "uu" and re.match(r"UNDANG[- ]?UNDANG DARURAT\b", head):
            doc.jenis, doc.work = "uu-drt", f"uu-drt_{doc.nomor}_{doc.tahun}"
        other = best.get(doc.work)
        rank = (QUALITY.get(doc.quality, 9), -len(doc.chunks))
        if other is None or rank < (QUALITY.get(other.quality, 9), -len(other.chunks)):
            best[doc.work] = doc
    dupes = len(docs) - len(best)
    if dupes:
        log.append(f"{dupes} further document(s) for regulations already present; the best-rated one is used")
    return best


# rebuilding the text ----------------------------------------------------------------------

BAB_TITLE = re.compile(r"^((?:BAB|Bab)\s+[IVXLC]+[A-Z]?)\.?\s+(\S.*)$")      # "BAB I KETENTUAN UMUM"
ORDINAL = r"(?:Ke(?:satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas)\w*|Pertama|\d+)"
PART_TITLE = re.compile(rf"^((?:Bagian|BAGIAN|Paragraf|PARAGRAF)\s+{ORDINAL})\.?\s+(\S.*)$")  # "Bagian Kesatu Hak untuk Hidup"
PASAL_NOTE = re.compile(r"^((?:Pasal|PASAL)\s*\d+[A-Z]?)\.?\s+(\S.*)$")       # "Pasal 3 Cukup jelas."
# several headings in one path segment: "Bagian Kesatu Hak untuk Hidup Pasal 9" (UU 39/1999)
NEXT_HEADING = re.compile(rf"\s+(?=(?:Bagian|Paragraf)\s+{ORDINAL}\b|Pasal\s+\d+[A-Z]?\.?$)")
MARKDOWN = re.compile(r"^#+\s*|\*\*|__")


def heading_lines(segment: str) -> list[str]:
    seg = MARKDOWN.sub("", segment).strip()
    if not seg:
        return []
    out: list[str] = []
    for part in NEXT_HEADING.split(seg):
        for pattern in (BAB_TITLE, PART_TITLE, PASAL_NOTE):
            if m := pattern.match(part):
                out += [m[1], m[2]]
                break
        else:
            out.append(part)
    return out


def listed_pasal(chunks: list[dict]) -> int:
    """How many distinct Pasal headings the dataset's paths hold outside the Penjelasan."""
    seen = set()
    for c in chunks:
        path = c["heading_path"] or ""
        if "PENJELASAN" in path.upper():
            continue
        for seg in path.split("›"):
            if m := re.search(r"\bPasal\s*(\d+[A-Z]?|[IVXLC]+)\b", seg, re.IGNORECASE):   # also "pasal 46" (UU 7/2017)
                seen.add(m[1])
    return len(seen)


KEEP = 0.9   # a rebuilt text must hold at least this share of the pasal headings the dataset lists


# preamble labels: the dataset keeps them in the path ("Menimbang") and their text in the chunk
# (": a. bahwa ..."), and the first chunk also holds the title, which comes before the label
LABEL_RE = re.compile(r"^(Menimbang|Mengingat|Memperhatikan|Mendengar|Menetapkan|MEMUTUSKAN|"
                      r"Memutuskan|Kepada|Untuk)\s*:?$")


def rebuild_lines(chunks: list[dict]) -> list[str]:
    """The document's lines in reading order: each heading of ``heading_path`` where the path
    first reaches it, then the chunk text. A preamble label goes where its text starts (the
    chunk's first line beginning with ':'), joined to it, else before the chunk text."""
    lines: list[str] = []
    path: list[str] = []
    for c in chunks:
        new = [s.strip() for s in (c["heading_path"] or "").split("›") if s.strip()]
        k = 0
        while k < min(len(path), len(new)) and path[k] == new[k]:
            k += 1
        labels: list[str] = []
        if new != path:
            for seg in new[k:]:
                for ln in heading_lines(seg):
                    if LABEL_RE.match(ln):
                        labels.append(LABEL_RE.match(ln)[1])
                    else:
                        lines.append(ln)
            path = new
        body = [MARKDOWN.sub("", ln).strip() for ln in (c["body"] or "").splitlines()]
        body = [ln for ln in body if ln]
        for label in labels:
            at = next((i for i, ln in enumerate(body) if ln.startswith(":")), None)
            if at is not None:
                body[at] = f"{label} {body[at]}"
            else:
                body.insert(0, label)
        lines += body
    return lines


# writing -----------------------------------------------------------------------------------

def record_for(doc: Doc, revision: str) -> dict:
    from ..naming import JENIS_TITLE
    from .peraturan_go_id import tanggal_iso

    about = (doc.meta.get("about") or "").strip() or None
    st = doc.status or {}
    return {
        "id": doc.work,
        "akn": f"/akn/id/act/{doc.jenis}/{doc.tahun}/{doc.nomor}",
        "type": doc.jenis,
        "number": doc.nomor,
        "year": doc.tahun,
        "title": f"{JENIS_TITLE.get(doc.jenis, doc.jenis.upper())} Nomor {doc.nomor.upper()} Tahun {doc.tahun}"
                 + (f" tentang {about.title()}" if about else ""),
        "tentang": about,
        "short_name": None,
        "status": STATUS.get(st.get("status")),
        "tanggal_penetapan": tanggal_iso(doc.meta.get("effective_date") or ""),
        "source_url": f"{HF}/datasets/{DATASET}",
        "relationships": {"amends": [], "amended_by": [], "revokes": [], "revoked_by": []},
        "versions": [],
        "id_reg": id_reg_block(doc, revision),
    }


def id_reg_block(doc: Doc, revision: str) -> dict:
    st = doc.status or {}
    return {
        "dataset": DATASET,
        "revision": revision,
        "doc_id": doc.doc_id,
        "source_title": doc.meta.get("source_title"),
        "regulation_type": doc.meta.get("regulation_type"),
        "quality": doc.quality,
        "chunks": len(doc.chunks),
        "status": st.get("status"),
        **({"revoked_by": list(st["revoked_by"])} if st.get("revoked_by") is not None and len(st["revoked_by"]) else {}),
        **({"amended_by": list(st["amended_by"])} if st.get("amended_by") is not None and len(st["amended_by"]) else {}),
    }


def convert(doc: Doc, rec: dict, folder: Path, revision: str) -> str:
    """Rebuild, parse and write the text of ``doc`` into ``rec``. Nothing is written unless
    the parse finds pasal and the text is valid Akoma Ntoso."""
    from ..akn.bluebell import to_bluebell
    from ..akn.build import to_akn
    from ..pdf.structure import PARSER_VERSION, parse_lines

    try:
        parsed = parse_lines(rebuild_lines(doc.chunks))
        if parsed.pasal_count == 0:
            rec["parse_error"] = f"v{PARSER_VERSION}: no pasal found in the rebuilt text"
            return "no pasal found"
        listed = listed_pasal(doc.chunks)
        if parsed.pasal_count < KEEP * listed:             # a damaged or misread text: do not publish it
            rec["parse_error"] = (f"v{PARSER_VERSION}: rebuilt text has {parsed.pasal_count} pasal, "
                                  f"the dataset lists {listed}")
            return f"too few pasal ({parsed.pasal_count} of {listed})"
        text = to_bluebell(parsed)
        to_akn(text, rec["akn"], "act")                    # validates structure and markup
    except Exception as e:  # noqa: BLE001 - record and move on; never guess
        rec["parse_error"] = f"{type(e).__name__}: {str(e)[:200]}"
        return f"parse error: {rec['parse_error'][:80]}"
    date = rec.get("tanggal_penetapan")
    version = f"{rec['id']}_{date or rec['year']}"
    folder.mkdir(parents=True, exist_ok=True)
    (folder / f"{version}.txt").write_text(text)
    rec.pop("parse_error", None)
    rec["versions"] = [{
        "id": version, "kind": "asli", "source": "dataset",
        "date": date, "date_basis": "tanggal_penetapan" if date else "tahun",
        "text": f"{version}.txt", "pasal_count": parsed.pasal_count,
        "parser_version": PARSER_VERSION,
        "text_source": SOURCE, "text_revision": revision, "text_doc_id": doc.doc_id,
        "rebuilt_from_chunks": True,
    }]
    return f"{parsed.pasal_count} pasal"


def import_all(data_dir: Path, bundle: Path, revision: str, types: set[str] | None = None,
               only: set[str] | None = None, limit: int | None = None) -> Iterator[str]:
    """Write a record (and text) for every national regulation in the dataset that we do
    not have, and a text for records that have none. Yields one log line per regulation."""
    log: list[str] = []
    docs = load(bundle, log)
    yield from log
    yield from import_docs(data_dir, docs, revision, types, only, limit)


def import_docs(data_dir: Path, docs: dict[str, Doc], revision: str, types: set[str] | None = None,
                only: set[str] | None = None, limit: int | None = None) -> Iterator[str]:
    done = 0
    for work in sorted(docs, key=lambda w: (docs[w].jenis, docs[w].tahun, docs[w].nomor)):
        doc = docs[work]
        if (types and doc.jenis not in types) or (only and work not in only):
            continue
        if limit is not None and done >= limit:
            break
        folder = data_dir / "peraturan" / doc.jenis / str(doc.tahun) / work
        record = folder / f"{work}.yaml"
        if record.exists():
            rec = yaml.safe_load(record.read_text()) or {}
            if any(v.get("text") for v in rec.get("versions") or []):
                continue                                   # never touch a text we have
            note = convert(doc, rec, folder, revision)
            if not rec.get("versions"):                    # nothing gained: the file is not rewritten
                yield f"--   {work}: {note} (existing record left unchanged)"
                continue
            rec["id_reg"] = id_reg_block(doc, revision)
        elif doc.jenis in COMPLETE_TYPES:
            # our list of these comes from BPK, which lists them all: one the dataset adds is
            # more likely mislabelled (an Undang-Undang Darurat filed as UU) than missing
            yield f"skip {work}: not in our records, whose list of {doc.jenis} is complete"
            continue
        else:
            rec = record_for(doc, revision)
            note = convert(doc, rec, folder, revision)
        folder.mkdir(parents=True, exist_ok=True)
        record.write_text(yaml.safe_dump(rec, allow_unicode=True, sort_keys=False))
        done += 1
        yield f"ok   {work}: {note}"
