"""``hukum-bersih explain``: which cell of the structure table read each line, and why the state
changed. The lines go through the real driver (``parse_lines`` with an observer, ``structure.py``),
so what is printed is what the parser did, not a second reading of the table.

Inputs, as ``scripts/compare_reparse.py`` and ``scripts/parser_identity.py`` read them, nothing
downloaded and no OCR run: a path to a PDF (cleaned lines of its text layer) or to a stored
Bluebell text (``stored.py``), or a law id, which finds a PDF in the cache
($HUKUM_BERSIH_PDF_CACHE) or else the latest stored text in data/.
"""

from __future__ import annotations

import os
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from pathlib import Path

from .stored import printed_lines
from .structure import Document, Trace, parse_lines

TEXT_WIDTH = 60     # characters of the line shown in a report row


@dataclass(frozen=True)
class Source:
    lines: list[str]
    origin: str
    notes: tuple[str, ...] = ()


def pdf_cache() -> Path:
    return Path(os.environ.get("HUKUM_BERSIH_PDF_CACHE") or Path.home() / ".cache" / "hukum-bersih" / "pdf")


def pdf_source(pdf: Path, extra: Sequence[Path] = ()) -> Source:
    """Cleaned lines of the PDF's own text layer. A scanned page is not OCR'd here: its text
    layer (often poor or empty) is read, and the notes say how many pages that touched."""
    import pymupdf

    from .extract import clean_lines, is_scan, page_lines

    lines, scans = [], 0
    for path in (pdf, *extra):
        with pymupdf.open(path) as doc:
            scans += sum(is_scan(page) for page in doc)
        lines += clean_lines(page_lines(path, ocr=False))
    skipped = (f"{scans} scanned page(s) need OCR and were skipped: read through their text layer, "
               "lines may be missing or misread (OCR runs on GitHub Actions)")
    notes = (skipped,) if scans else ()
    return Source(lines, ", ".join(p.name for p in (pdf, *extra)), notes)


def stored_source(text: Path) -> Source:
    return Source(printed_lines(text.read_text(encoding="utf-8")), str(text),
                  ("stored text turned back into printed lines: close to the PDF's cleaned lines, not equal",))


def law_dir(data_dir: Path, law: str) -> Path:
    jenis, _, year = law.split("_")
    return data_dir / "peraturan" / jenis / year / law


def law_source(data_dir: Path, law: str, prefer_text: bool = False) -> Source:
    pdfs = sorted(pdf_cache().glob(f"{law}.pdf")) + sorted(pdf_cache().glob(f"{law}_[0-9]*.pdf"))
    texts = sorted(law_dir(data_dir, law).glob(f"{law}_*.txt"))
    if pdfs and not prefer_text:
        penjelasan = sorted(pdf_cache().glob(f"{law}_penjelasan_*.pdf"))
        return pdf_source(pdfs[0], penjelasan)
    if texts:
        return stored_source(texts[-1])
    raise FileNotFoundError(f"{law}: no cached PDF in {pdf_cache()} and no stored text in {law_dir(data_dir, law)}")


def resolve(target: str, data_dir: Path, prefer_text: bool = False) -> Source:
    path = Path(target)
    if path.suffix.lower() == ".pdf":
        return pdf_source(path)
    if path.is_file():
        return stored_source(path)
    return law_source(data_dir, target, prefer_text)


def trace(lines: list[str]) -> tuple[Document, list[Trace]]:
    """The document and every cell reading of every line, from the real driver."""
    events: list[Trace] = []
    return parse_lines(lines, events.append), events


def select(events: Iterable[Trace], first: int = 1, last: int | None = None,
           states: Sequence[str] = (), cells: Sequence[str] = ()) -> list[Trace]:
    """Events on lines ``first``..``last`` (1-based, of the normalised lines), read in one of
    ``states`` (the state before) and by one of ``cells``; an empty filter keeps all."""
    return [e for e in events
            if e.at + 1 >= first and (last is None or e.at + 1 <= last)
            and (not states or e.before in states) and (not cells or e.cell.name in cells)]


def row(e: Trace) -> str:
    kinds = ",".join(e.line.kinds) or "-"
    again = "  (read again)" if not e.used else ""
    text = e.line.text if len(e.line.text) <= TEXT_WIDTH else e.line.text[:TEXT_WIDTH - 1] + "…"
    return (f"{e.at + 1:>6}  {e.before:<18} {e.cell.name:<24} {'+'.join(e.cell.ids):<16} "
            f"{e.after:<18} {kinds:<20} {text}{again}")


def report(events: Iterable[Trace]) -> str:
    head = (f"{'line':>6}  {'state before':<18} {'cell':<24} {'rules':<16} {'state after':<18} "
            f"{'kinds':<20} text")
    return "\n".join([head, *map(row, events)])
