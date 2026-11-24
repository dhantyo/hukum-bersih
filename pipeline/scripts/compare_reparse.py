"""Why did a re-parse come out poorer than the stored text? For each law id: parse its PDF with
the current parser and put the result next to the stored text, as the importer's refusal
rules see it (pasal count, words of the body and of the Penjelasan; sources/peraturan_go_id.py).

    uv run python scripts/compare_reparse.py [--max-diff N] [--pages 3,5] [--save DIR] id...

Per law it prints the counts old vs new, the importer's verdict, every parse warning, every
page header/footer line the position rules (pdf/edges.py) took out with its page, a unified
diff of stored vs new text trimmed to the changed hunks, and with ``--pages`` the cleaned lines
of those pages (1-based). Read-only: nothing in data/ is written.

PDFs: the file the record names in ``bpk.files`` from the Hugging Face mirror of BPK
(``data/sources/mirrors/id_reg.json``), downloaded once into $HUKUM_BERSIH_PDF_CACHE (default
~/.cache/hukum-bersih/pdf), never into the repository. Scanned pages are OCR'd (slow; the OCR
cache keeps them, pdf/ocr_cache.py). Prints Markdown (the workflow appends it to the job summary).
"""

from __future__ import annotations

import argparse
import difflib
import json
import os
import re
import sys
import urllib.parse
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = HERE.parent.parent / "data"
CACHE = Path(os.environ.get("HUKUM_BERSIH_PDF_CACHE") or Path.home() / ".cache" / "hukum-bersih" / "pdf")
HF = "https://huggingface.co/datasets/Azzindani/ID_REG/resolve/main/"
sys.path.insert(0, str(HERE.parent / "src"))

from hukum_bersih.akn.bluebell import to_bluebell
from hukum_bersih.manifest import sha256_file
from hukum_bersih.pdf import extract
from hukum_bersih.pdf.structure import PARSER_VERSION, parse_pdf
from hukum_bersih.records import load_record
from hukum_bersih.sources.peraturan_go_id import _words_lost

CONTEXT = 2          # unchanged lines kept around a changed hunk


def record_path(law: str) -> Path:
    jenis, _, tahun = law.split("_")
    return DATA / "peraturan" / jenis / tahun / law / f"{law}.yaml"


def mirror_member(rec: dict) -> tuple[str, str]:
    """(zip, member) of the record's BPK file in the Hugging Face mirror."""
    files = json.loads((DATA / "sources" / "mirrors" / "id_reg.json").read_text())["files"]
    names = [f["filename"] for f in (rec.get("bpk") or {}).get("files") or [] if f.get("filename")]
    names.append(urllib.parse.unquote((rec.get("source_pdf_url") or "").rsplit("/", 1)[-1]))
    for name in names:
        member = name.replace(" ", "_")
        if member in files:
            return files[member][0], member
    raise SystemExit(f"{rec['id']}: none of {names} is in the mirror")


def pdf_for(law: str, rec: dict) -> Path:
    path = CACHE / f"{law}.pdf"
    if not path.exists():
        from remotezip import RemoteZip

        CACHE.mkdir(parents=True, exist_ok=True)
        zip_name, member = mirror_member(rec)
        with RemoteZip(HF + zip_name) as z:
            path.write_bytes(z.read(member))
    return path


TAIL_RE = re.compile(r"ATTACHMENT Lampiran|TAMBAHAN LEMBARAN NEGARA REPUBLIK INDONESIA NOMOR")


def counts(text: str) -> tuple[int, int, int, int]:
    """(Pasal lines, words of the body, words of the Penjelasan proper, words after it). The
    importer counts everything after "ATTACHMENT Penjelasan" as Penjelasan, a map's OCR noise
    in the Lampiran included (UU 16/2022); here the Penjelasan ends at its "TAMBAHAN LEMBARAN
    NEGARA" line or at a Lampiran heading, so that noise shows on its own."""
    body, _, rest = text.partition("ATTACHMENT Penjelasan")
    m = TAIL_RE.search(rest)
    penj, tail = (rest[:m.start()], rest[m.start():]) if m else (rest, "")
    words = lambda t: len(re.findall(r"\w+", t))
    return len(re.findall(r"^\s*Pasal\s+\S+\s*$", body, re.MULTILINE)), words(body), words(penj), words(tail)


def trimmed_diff(old: str, new: str, limit: int) -> list[str]:
    out = [ln.rstrip("\n") for ln in difflib.unified_diff(
        old.splitlines(), new.splitlines(), "stored", f"v{PARSER_VERSION}", n=CONTEXT, lineterm="")]
    if len(out) > limit:
        out = out[:limit] + [f"... {len(out) - limit} more diff lines (raise --max-diff)"]
    return out


SIMILAR = 0.9        # a changed block whose words are at least this alike is a small edit, not new content
HEADING_RE = re.compile(r"^\s*(?:ART|CHAPTER|PART|SECTION|ATTACHMENT)\b.*$")


def block_changes(old: str, new: str, limit: int) -> tuple[list[str], list[str]]:
    """Changed line blocks of stored vs new text, split into (substantive, small edits). A block
    is small when the words of both sides (punctuation aside) are at least SIMILAR alike; its changed words print as
    ``old -> new``. Everything else (lines lost or added, text that differs) prints in full."""
    a, b = old.splitlines(), new.splitlines()
    big: list[str] = []
    small: list[str] = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if op == "equal":
            continue
        ow, nw = " ".join(a[i1:i2]).split(), " ".join(b[j1:j2]).split()
        sm = difflib.SequenceMatcher(None, ow, nw, autojunk=False)
        # alike by their words, punctuation aside ("Papua," -> "Papua;" is a small edit)
        alike = difflib.SequenceMatcher(None, re.findall(r"\w+", " ".join(ow)), re.findall(r"\w+", " ".join(nw)),
                                        autojunk=False).ratio()
        if ow and nw and alike >= SIMILAR:
            small += [f"{' '.join(ow[x1:x2]) or '∅'} -> {' '.join(nw[y1:y2]) or '∅'}   (old line {i1 + 1})"
                      for tag, x1, x2, y1, y2 in sm.get_opcodes() if tag != "equal"]
        else:
            big += [f"@@ stored lines {i1 + 1}-{i2}, new lines {j1 + 1}-{j2} @@"]
            big += [f"- {ln[:300]}" for ln in a[i1:i2] if ln.strip()]
            big += [f"+ {ln[:300]}" for ln in b[j1:j2] if ln.strip()]
    for name, lines in (("substantive", big), ("small", small)):
        if len(lines) > limit:
            lines[limit:] = [f"... more {name} lines (raise --max-diff)"]
    return big, small


def heading_diff(old: str, new: str) -> list[str]:
    pick = lambda t: [ln.strip() for ln in t.splitlines() if HEADING_RE.match(ln)]
    return [ln for ln in difflib.unified_diff(pick(old), pick(new), "stored", "new", n=0, lineterm="") if ln[:1] in "+-" and ln[:3] not in ("+++", "---")]


def compare(law: str, max_diff: int, pages: list[int], save: str = "") -> None:
    rec = load_record(record_path(law))
    version = next((v for v in rec.get("versions") or [] if v.get("text")), None)
    stored_path = record_path(law).parent / version["text"] if version else None
    stored = stored_path.read_text() if stored_path and stored_path.exists() else ""
    pdf = pdf_for(law, rec)
    stats: dict = {}
    doc = parse_pdf(pdf, stats=stats)
    new = to_bluebell(doc)
    if save:
        Path(save).mkdir(parents=True, exist_ok=True)
        (Path(save) / f"{law}.txt").write_text(new)

    print(f"\n## {law}\n")
    print(f"record: reparse_error `{rec.get('reparse_error')}`, recheck `{rec.get('recheck')}`")
    sha = sha256_file(pdf)
    print(f"PDF {pdf.name}, sha256 {'is' if version and version.get('pdf_sha256') == sha else 'is NOT'} the record's\n")
    old_pasal, old_body, old_penj, old_tail = counts(stored)
    new_pasal, new_body, new_penj, new_tail = counts(new)
    print(f"| | stored (v{version.get('parser_version') if version else '-'}) | new (v{PARSER_VERSION}) |")
    print("|---|---|---|")
    print(f"| pasal (record's `pasal_count`; parser's count) | {version.get('pasal_count') if version else '-'} | {doc.pasal_count} |")
    print(f"| lines `Pasal …` in the text (quoted pasal of amending laws too) | {old_pasal} | {new_pasal} |")
    print(f"| body words | {old_body} | {new_body} ({new_body - old_body:+d}) |")
    print(f"| Penjelasan words (proper: before its TLN line or a Lampiran) | {old_penj} | {new_penj} ({new_penj - old_penj:+d}) |")
    print(f"| words after it (TLN line, Lampiran) | {old_tail} | {new_tail} ({new_tail - old_tail:+d}) |")
    print(f"\nimporter: {_words_lost(stored_path, new) if stored else 'no stored text'}"
          f"; pasal {doc.pasal_count} vs {version.get('pasal_count') if version else 0}"
          f"{' (amending: pasal not compared)' if doc.amending else ''}\n")

    print("warnings:")
    for w in doc.warnings:
        print(f"- {w}")
    print(f"\nedges: {len(stats['edge_at'])} line(s) removed by position")
    for page, text in stats["edge_at"]:
        print(f"- p{page}: `{text}`")

    big, small = block_changes(stored, new, max_diff)
    print("\nstructure lines (ART / CHAPTER / PART / SECTION / ATTACHMENT) that differ:\n```diff")
    print("\n".join(heading_diff(stored, new)) or "(none)")
    print("```")
    print(f"\nsubstantive differences (lost, added or rewritten text): {sum(ln.startswith('@@') for ln in big)} block(s)\n```diff")
    print("\n".join(big) or "(none)")
    print("```")
    print(f"\nsmall edits (stored -> new, words only): {len(small)}\n```")
    print("\n".join(small))
    print("```")
    print("\nunified diff, trimmed:\n```diff")
    print("\n".join(trimmed_diff(stored, new, max_diff)))
    print("```")

    if pages:
        lines = extract.page_lines(pdf)
        for n in pages:
            print(f"\npage {n}, lines after the position rules (before text cleaning):\n```")
            print("\n".join(lines[n - 1]))
            print("```")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("ids", nargs="+")
    ap.add_argument("--max-diff", type=int, default=300, help="lines printed per part of the diff, per law")
    ap.add_argument("--save", default="", help="directory to write each new text to (<id>.txt, for a closer look)")
    ap.add_argument("--pages", default="", help="1-based pages whose cleaned lines to print, all laws")
    args = ap.parse_args()
    pages = [int(p) for p in args.pages.split(",") if p.strip()]
    for law in args.ids:
        try:
            compare(law, args.max_diff, pages, args.save)
        except Exception as e:  # noqa: BLE001 - one law's failure must not hide the others
            print(f"\n## {law}\n\nERROR {type(e).__name__}: {e}")


if __name__ == "__main__":
    main()
