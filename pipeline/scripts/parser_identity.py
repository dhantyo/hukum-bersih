"""Does a parser change keep every document the same? Parse the same lines with the parser of a
git ref (default ``origin/main``) and with the working tree's, and list every document whose
blocks (kind, label, text, level) or warnings differ.

    uv run python scripts/parser_identity.py [--base REF] [--lines-cache DIR] [--show N]

Inputs, all local, nothing downloaded and no OCR run:

- every PDF in the PDF cache ($HUKUM_BERSIH_PDF_CACHE, default ~/.cache/hukum-bersih/pdf, filled
  by regress.py and compare_reparse.py), read into cleaned lines once with ``ocr=False``
  (scanned pages through their own text layer); ``--lines-cache`` keeps those lines between runs;
- every stored text in data/ (Bluebell), turned back into printed lines: headings as printed
  (``BAB I`` and its title, ``Pasal 1``), markers in front of their text (``(1) …``, ``a. …``),
  Penjelasan parts as ``I. UMUM``. Close to the cleaned lines of the law, not equal to them.

Both parsers get the same lines, so this compares ``parse_lines`` (pdf/structure.py and what it
imports) and nothing before it. Exit status 1 if any document differs. Read-only.
"""

from __future__ import annotations

import argparse
import dataclasses
import gzip
import hashlib
import importlib.util
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
DATA = ROOT / "data"
PDFS = Path(os.environ.get("HUKUM_BERSIH_PDF_CACHE") or Path.home() / ".cache" / "hukum-bersih" / "pdf")
sys.path.insert(0, str(HERE.parent / "src"))

from hukum_bersih.pdf import structure as current

SECTIONS = {"PREFACE", "PREAMBLE", "BODY", "CONCLUSIONS", "BLOCKLIST"}
HEADINGS = {"CHAPTER": "BAB", "PART": "Bagian", "SUBPART": "Paragraf", "ART": "Pasal"}
HEADING_RE = re.compile(r"^(CHAPTER|PART|SUBPART|ART) (\S+) -(?: (.*))?$")
MARKER_RE = re.compile(r"^(?:PARA|POINT|ITEM) (.+)$")
PENJELASAN_PART = {"PART I - UMUM": "I. UMUM", "PART II - PASAL DEMI PASAL": "II. PASAL DEMI PASAL"}


def base_parser(ref: str):
    """The parser module of ``ref``, imported next to the working tree's package so that its
    relative imports (``.ocr_fix``) resolve."""
    source = subprocess.run(["git", "show", f"{ref}:pipeline/src/hukum_bersih/pdf/structure.py"],
                            cwd=ROOT, check=True, capture_output=True, text=True).stdout
    path = Path(tempfile.mkdtemp()) / "structure.py"
    path.write_text(source, encoding="utf-8")
    spec = importlib.util.spec_from_file_location("hukum_bersih.pdf._base_structure", path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def printed_lines(text: str) -> list[str]:
    """A stored Bluebell text back as printed lines (see the module docstring)."""
    out, marker = [], ""
    for raw in text.splitlines():
        line = raw.strip().removeprefix("\\")
        if not line or line in SECTIONS or line.startswith("ATTACHMENT "):
            continue
        if line in PENJELASAN_PART:
            out.append(PENJELASAN_PART[line])
        elif line.startswith("PART - "):
            out.append(line.removeprefix("PART - "))
        elif m := HEADING_RE.match(line):
            out.append(f"{HEADINGS[m[1]]} {m[2]}")
            if m[3]:
                out.append(m[3])
        elif m := MARKER_RE.match(line):
            marker = m[1] + " "
        else:
            out.append(marker + line)
            marker = ""
    return out


def pdf_lines(pdf: Path, cache: Path | None) -> list[str]:
    from hukum_bersih.pdf.extract import clean_lines, page_lines

    key = cache / f"{hashlib.sha256(pdf.read_bytes()).hexdigest()}.json.gz" if cache else None
    if key and key.exists():
        return json.loads(gzip.decompress(key.read_bytes()))
    lines = clean_lines(page_lines(pdf, ocr=False))
    if key:
        key.parent.mkdir(parents=True, exist_ok=True)
        key.write_bytes(gzip.compress(json.dumps(lines).encode()))
    return lines


def inputs(cache: Path | None):
    for pdf in sorted(PDFS.glob("*.pdf")):
        yield f"pdf:{pdf.name}", pdf_lines(pdf, cache)
    for txt in sorted(DATA.glob("**/*.txt")):
        yield f"text:{txt.relative_to(DATA)}", printed_lines(txt.read_text(encoding="utf-8"))


def outcome(module, lines: list[str]) -> list:
    try:
        doc = module.parse_lines(list(lines))
    except Exception as e:  # noqa: BLE001 - a crash is an outcome to compare too
        return [f"error: {type(e).__name__}: {e}"]
    return [dataclasses.astuple(b) for b in doc.blocks] + [("warning", w) for w in doc.warnings]


def first_difference(old: list, new: list) -> str:
    for k, (a, b) in enumerate(zip(old, new)):
        if a != b:
            return f"  item {k}\n    base: {a!r}\n    new:  {b!r}"
    return f"  lengths {len(old)} vs {len(new)}"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--base", default="origin/main", help="git ref of the parser to compare with")
    ap.add_argument("--lines-cache", type=Path, help="keep the PDFs' cleaned lines here between runs")
    ap.add_argument("--show", type=int, default=20, help="differences printed in full")
    args = ap.parse_args()

    base = base_parser(args.base)
    counts = {"pdf": 0, "text": 0}
    lines_total, differ = 0, []
    for name, lines in inputs(args.lines_cache):
        counts[name.split(":")[0]] += 1
        lines_total += len(lines)
        old, new = outcome(base, lines), outcome(current, lines)
        if old != new:
            differ.append(name)
            if len(differ) <= args.show:
                print(f"DIFF {name}\n{first_difference(old, new)}")
    print(f"{counts['pdf']} PDFs and {counts['text']} stored texts, {lines_total} lines, "
          f"parser of {args.base} vs working tree: {len(differ)} differ")
    for name in differ[args.show:]:
        print(f"DIFF {name}")
    return 1 if differ else 0


if __name__ == "__main__":
    raise SystemExit(main())
