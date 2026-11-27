"""Does a parser change keep every document the same? Parse the same lines with the parser of a
git ref (default ``origin/main``) and with the working tree's, and list every document whose
blocks (kind, label, text, level) or warnings differ.

    uv run python scripts/parser_identity.py [--base REF] [--lines-cache DIR] [--show N] [--fuzz N]

Inputs, all local, nothing downloaded and no OCR run:

- every PDF in the PDF cache ($HUKUM_RAPIH_PDF_CACHE, default ~/.cache/hukum-rapih/pdf, filled
  by regress.py and compare_reparse.py), read into cleaned lines once with ``ocr=False``
  (scanned pages through their own text layer); ``--lines-cache`` keeps those lines between runs;
- every stored text in data/ (Bluebell), turned back into printed lines: headings as printed
  (``BAB I`` and its title, ``Pasal 1``), markers in front of their text (``(1) …``, ``a. …``),
  Penjelasan parts as ``I. UMUM``. Close to the cleaned lines of the law, not equal to them;
- with ``--fuzz N``, N made-up documents of lines printed in the laws (``FUZZ_LINES``), in a
  random order that mostly runs front to back, so the rare orders the laws hardly contain (a
  certification inside a Lampiran, a closing line in the Penjelasan) are compared too.

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
import random
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
DATA = ROOT / "data"
PDFS = Path(os.environ.get("HUKUM_RAPIH_PDF_CACHE") or Path.home() / ".cache" / "hukum-rapih" / "pdf")
sys.path.insert(0, str(HERE.parent / "src"))

from hukum_rapih.pdf import structure as current
from hukum_rapih.pdf.stored import printed_lines


def base_parser(ref: str):
    """The parser module of ``ref``, imported next to the working tree's package so that its
    relative imports (``.ocr_fix``) resolve."""
    source = subprocess.run(["git", "show", f"{ref}:pipeline/src/hukum_rapih/pdf/structure.py"],
                            cwd=ROOT, check=True, capture_output=True, text=True).stdout
    path = Path(tempfile.mkdtemp()) / "structure.py"
    path.write_text(source, encoding="utf-8")
    spec = importlib.util.spec_from_file_location("hukum_rapih.pdf._base_structure", path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


# Lines printed in the laws, by the part of a law they belong to. ``{n}``, ``{r}``, ``{a}``:
# a number, Roman number and letter near the last one drawn, so headings come mostly in sequence.
FUZZ_LINES = {
    "front": ["PRESIDEN", "REPUBLIK INDONESIA", "SALINAN", "UNDANG-UNDANG REPUBLIK INDONESIA",
              "NOMOR {n} TAHUN 2000", "TENTANG", "PERUBAHAN ATAS UNDANG-UNDANG NOMOR 2 TAHUN 1990",
              "DENGAN RAHMAT TUHAN YANG MAHA ESA", "PRESIDEN REPUBLIK INDONESIA,"],
    "preamble": ["Menimbang :", "Menimbang : a. bahwa negara;", "Mengingat", ":", ": 1. Pasal 5;",
                 ": bahwa", "a. bahwa ini;", "b. bahwa itu;", "c. bahwa", "1. Pasal 20;", "2. Pasal 21;",
                 "Dengan Persetujuan Bersama", "MEMUTUSKAN:", "Menetapkan : UNDANG-UNDANG TENTANG X.",
                 "DEWAN PERWAKILAN RAKYAT"],
    "body": ["BAB {r}", "Bab Pertama", "Bab Kedua", "KETENTUAN UMUM", "Tentang Urusan Rumah-Tangga",
             "dan Kewajiban", "Bagian Kesatu", "Bagian Kedua", "Paragraf {n}", "Umum",
             "Pasal {n}", "Pasal {n}", "Pasal {n}", "Pasal {n}A", "Pasal {r}", "Pasal 1", "Pasal 2",
             "Pasal I", "Pasal II", "({n}) Setiap orang berhak.", "({n}) Dalam hal", "{a}. huruf;",
             "{a}. huruf", "{n}. angka;", "a. pertama", "1. pertama", "Isi pasal ini.", "berlaku",
             "sebagaimana dimaksud dalam", "Pasal {n} ayat (1).", "sehingga berbunyi sebagai berikut:",
             "Beberapa ketentuan dalam Undang-Undang diubah sebagai berikut:", "Ketentuan Pasal 5 diubah",
             "dihapus.", "Undang-", "Undang ini mulai berlaku.", "RANCANGAN"],
    "closing": ["Agar setiap orang mengetahuinya, memerintahkan", "pengundangan Undang-Undang ini.",
                "Disahkan di Jakarta", "pada tanggal 1 Januari 2000", "PRESIDEN REPUBLIK INDONESIA,",
                "ttd.", "Diundangkan di Jakarta", "LEMBARAN NEGARA REPUBLIK INDONESIA TAHUN 2000 NOMOR 1",
                "TAMBAHAN LEMBARAN NEGARA NOMOR 1", "Djakarta, tanggal 1 Nopember 1945", "RANCANGAN"],
    "salinan": ["Salinan sesuai dengan aslinya", "KEMENTERIAN SEKRETARIAT NEGARA", "Kepala Biro",
                "ttd."],
    "penjelasan": ["PENJELASAN", "PENJELASAN ATAS", "UNDANG-UNDANG NOMOR 1 TAHUN 2000", "PENJELASAN UMUM",
                   "MEMORI PENJELASAN", "I. UMUM", "1. UMUM", "A. PENJELASAN UMUM.", "II. PASAL DEMI PASAL",
                   "I.", "II.", "PENJELASAN PASAL DEMI PASAL", "Umum ini.", "Negara ini", "Pasal {n}",
                   "Pasal {n}", "Pasal {r}", "Pasal I", "Pasal II", "Cukup jelas", "Cukup jelas.",
                   "Ayat ({n})", "Huruf {a}", "Angka {n}", "Yang dimaksud dengan"],
    "lampiran": ["LAMPIRAN", "LAMPIRAN I", "LAMPIRAN II", "peta wilayah", "Pasal {n}"],
}
ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"]
FUZZ_ORDER = ["front", "preamble", "body", "closing", "salinan", "penjelasan", "closing", "lampiran",
              "salinan", "penjelasan"]


def fuzz_lines(rng: random.Random) -> list[str]:
    """A made-up document: the parts of FUZZ_ORDER in turn, some skipped, each line now and then
    taken from another part. Each numbered line form keeps its own count; a Pasal restarts the
    ayat and list counts."""
    counts: dict[str, int] = {}
    out = []
    for part in FUZZ_ORDER:
        if part != "front" and rng.random() < 0.25:
            continue
        for _ in range(rng.randint(1, 25)):
            form = rng.choice(FUZZ_LINES[part if rng.random() < 0.94 else rng.choice(list(FUZZ_LINES))])
            if form.startswith("Pasal {"):
                counts = {f: c for f, c in counts.items() if f.startswith(("Pasal", "BAB"))}
            n = counts[form] = max(1, counts.get(form, 0) + rng.choice([-1, 0, 1, 1, 1, 1, 2, 3]))
            out.append(form.format(n=n, r=ROMAN[min(n, 10) - 1], a="abcdefgh"[min(n, 8) - 1]))
    return out


def pdf_lines(pdf: Path, cache: Path | None) -> list[str]:
    from hukum_rapih.pdf.extract import clean_lines, page_lines

    key = cache / f"{hashlib.sha256(pdf.read_bytes()).hexdigest()}.json.gz" if cache else None
    if key and key.exists():
        return json.loads(gzip.decompress(key.read_bytes()))
    lines = clean_lines(page_lines(pdf, ocr=False))
    if key:
        key.parent.mkdir(parents=True, exist_ok=True)
        key.write_bytes(gzip.compress(json.dumps(lines).encode()))
    return lines


def inputs(cache: Path | None, fuzz: int):
    rng = random.Random(0)
    for k in range(fuzz):
        yield f"fuzz:{k}", fuzz_lines(rng)
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
    ap.add_argument("--fuzz", type=int, default=0, help="also compare this many made-up documents")
    args = ap.parse_args()

    base = base_parser(args.base)
    counts = {"pdf": 0, "text": 0, "fuzz": 0}
    lines_total, differ = 0, []
    for name, lines in inputs(args.lines_cache, args.fuzz):
        counts[name.split(":")[0]] += 1
        lines_total += len(lines)
        old, new = outcome(base, lines), outcome(current, lines)
        if old != new:
            differ.append(name)
            if len(differ) <= args.show:
                print(f"DIFF {name}\n{first_difference(old, new)}")
    print(f"{counts['pdf']} PDFs, {counts['text']} stored texts and {counts['fuzz']} made-up documents, {lines_total} lines, "
          f"parser of {args.base} vs working tree: {len(differ)} differ")
    for name in differ[args.show:]:
        print(f"DIFF {name}")
    return 1 if differ else 0


if __name__ == "__main__":
    raise SystemExit(main())
