"""Build the word list that OCR corrections are checked against (pdf/ocr_rules/lexicon.txt).

    uv run python scripts/build_lexicon.py [--data ../data] [--min-docs 3]

A word goes in when it appears in at least ``--min-docs`` typed texts (versions without
``ocr``) made by a parser that OCRs scans itself (version 6+). Some typed PDFs still carry
someone else's OCR, so a word is dropped when a letter-shape confusion (ocr_rules/
confusions.yaml) turns it into a word at least ``MISREAD_RATIO`` times as common and Hunspell does not know it
("dalarn" in 10 texts, "dalam" in 1,537; "kenangan" stays). Needs Hunspell id_ID + en_US. Each line is ``word<TAB>number of texts``, most frequent first. Rerun after a
large import; review the diff like any other data change.
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "src"))

from hukum_rapih.records import load_record

OUT = HERE.parent / "src" / "hukum_rapih" / "pdf" / "ocr_rules" / "lexicon.txt"
WORD = re.compile(r"[A-Za-z]+")
MISREAD_RATIO = 100


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path, default=HERE.parent.parent / "data")
    ap.add_argument("--min-docs", type=int, default=3)
    args = ap.parse_args()

    docs: Counter[str] = Counter()
    texts = 0
    for path in sorted((args.data / "peraturan").glob("*/*/*/*.yaml")):
        rec = load_record(path)
        for v in rec.get("versions") or []:
            text = path.parent / (v.get("text") or "")
            if v.get("ocr") or (v.get("parser_version") or 0) < 6 or not text.is_file():
                continue
            texts += 1
            docs.update({w.lower() for w in WORD.findall(text.read_text())})
    sys.path.insert(0, str(HERE.parent / "src"))
    from hukum_rapih.pdf.ocr_fix import _shapes, dictionary_words

    suspect = {w for w, n in docs.items() if n >= args.min_docs
               and any(docs.get(s, 0) >= MISREAD_RATIO * n for s in _shapes(w))}
    real = dictionary_words(suspect)
    if real is None:
        sys.exit("Hunspell with id_ID and en_US is needed (apt install hunspell hunspell-id hunspell-en-us)")

    def misread(word: str, n: int) -> bool:
        return word in suspect and word not in real

    kept = sorted(((w, n) for w, n in docs.items() if n >= args.min_docs and not misread(w, n)),
                  key=lambda x: (-x[1], x[0]))
    dropped = sorted(w for w, n in docs.items() if n >= args.min_docs and misread(w, n))
    print(f"dropped as misreads: {len(dropped)}: {' '.join(dropped[:40])}")
    OUT.write_text("".join(f"{w}\t{n}\n" for w, n in kept))
    print(f"{len(kept)} words from {texts} typed texts -> {OUT}")


if __name__ == "__main__":
    main()
