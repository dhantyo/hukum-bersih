"""Printed page header and footer of scanned pages, found by where the OCR put them.

Matching their text fails when the OCR misreads them ("RESIDEN REPUBlK INDONESIA", "PR EN
REPUBLIK INDONESIA", UU 100/2024), and a misread header then lands in the law. What survives
misreading is the layout. But layouts differ per kind of regulation, so the markers belong to a
``Layout``, and a document is only trimmed when its pages show a layout we know. Any other
document (a Perda, a Peraturan BPK, ...) loses nothing here: the top of its page 1 is law text,
e.g. "GUBERNUR GORONTALO" / "PERATURAN DAERAH PROVINSI GORONTALO" / "NOMOR 7 TAHUN 2025", or
"PERATURAN BADAN PEMERIKSA KEUANGAN" / "REPUBLIK INDONESIA" / "NOMOR 3 TAHUN 2026".

``edge_rows`` decides from the boxes of a page's rows which of them are header or footer. It
trusts a marker (page number, serial, title) only in its band of the page and its alignment, and
a page without the markers loses nothing. The text rules in ``extract.py`` stay as a second net
for what position does not catch. Only scanned pages go through here; a typed PDF's text layer
is read as before.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal, NamedTuple


class Row(NamedTuple):
    """A printed line of a page: its box in points and its text."""

    x0: float
    y0: float
    x1: float
    y1: float
    text: str


@dataclass(frozen=True)
class Marker:
    """A line that anchors a band: its text, the part of the page height it may stand in
    (``top``..``bottom``, fractions from the top) and where it sits across the page."""

    pattern: re.Pattern
    top: float
    bottom: float
    align: Literal["centre", "left", "right", "any"]

    def matches(self, row: Row, width: float, height: float) -> bool:
        cy = (row.y0 + row.y1) / 2 / height
        if not (self.top <= cy <= self.bottom and self.pattern.match(row.text.strip())):
            return False
        if self.align == "any":
            return True
        if self.align == "centre":
            return abs((row.x0 + row.x1) / 2 - width / 2) <= 0.15 * width
        if self.align == "left":
            return row.x0 <= 0.25 * width
        return row.x0 >= 0.4 * width


@dataclass(frozen=True)
class Layout:
    """How the pages of one kind of regulation are printed. ``title`` ends the letterhead on
    page 1 (the lines above it, when they look like a letterhead, are not law text); a layout
    without a ``title`` has no letterhead to remove."""

    name: str
    number: Marker
    serial: Marker
    page_turn: Marker
    title: Marker | None = None
    stamp: Marker | None = None       # a stamp beside the letterhead on page 1 ("SALINAN")


# Setneg layout, the UU, Perppu, PP and Perpres PDFs of BPK, top to bottom (UU 100/2024):
#     crest, "PRESIDEN" / "REPUBLIK INDONESIA" (centred; page 1 adds "UNDANG-UNDANG REPUBLIK
#     INDONESIA" below it), "- 2 -" (pages 2+), body, a right-aligned page-turn word ("Mengingat
#     . .", "Pasal 2 . . .", "c. sebelah . . ."), "SK No 208513 A" (bottom left).
LETTERHEAD_BAND_STAMP = 0.25

SETNEG = Layout(
    name="setneg",
    # "- 2 -", also read as "-2 -", "- 2-", "— 2 —": digits between dashes, at most a speck beside them
    number=Marker(re.compile(r"^\W{0,2}[-–—]\s*\d{1,4}\s*[-–—]?\W{0,2}$|^\W{0,2}\d{1,4}\s*[-–—]\W{0,2}$"),
                  0.0, 0.30, "centre"),
    # "SK No 208513 A", "SK Na 103881 A", "SK No 1039N5 A": the printer's serial, bottom left.
    serial=Marker(re.compile(r"^SK\s*N[oa-z9]\.?\s*[0-9A-Z'\s]{5,10}[A-Z]?\W{0,2}$", re.IGNORECASE),
                  0.80, 1.0, "left"),
    # "Mengingat . .", "Pasal 2 . . .", "d. bahwa …": the first words of the next page.
    page_turn=Marker(re.compile(r"^(?=.{1,40}$).*\w.*?(?:…|\.\s*\.)[\s.…]*$"), 0.75, 1.0, "right"),
    # the title that ends page 1's letterhead, or the page where the Penjelasan starts
    title=Marker(re.compile(r"^(?:UN[DO]ANG|PERATURAN|KEPUTUSAN|INSTRUKSI|PENJELASAN)\b", re.IGNORECASE),
                 0.0, 0.35, "centre"),
    # "SALINAN" (copy) in a box top right of page 1, level with the crest (Perpres 46/2026)
    stamp=Marker(re.compile(r"^\W{0,3}SALINAN\W{0,3}$", re.IGNORECASE), 0.0, LETTERHEAD_BAND_STAMP, "any"),
)
LAYOUTS = (SETNEG,)

LETTERHEAD_BAND = 0.25      # a letterhead line stands in the top quarter of page 1
LETTERHEAD_MAX_CHARS = 30   # "REPUBLIK INDONESIA" is the longest


class Edges(NamedTuple):
    """Indices of a page's rows that are header and footer."""

    head: frozenset[int] = frozenset()
    foot: frozenset[int] = frozenset()

    @property
    def gone(self) -> frozenset[int]:
        return self.head | self.foot


Page = tuple[list[Row], float, float]            # rows, width, height


def _find(marker: Marker, rows: list[Row], width: float, height: float) -> int | None:
    return next((i for i, r in enumerate(rows) if marker.matches(r, width, height)), None)


def detect_layout(later_pages: list[Page]) -> Layout | None:
    """The layout whose page number and serial stand on at least half of the document's pages
    2+ (scanned ones), and on one at least. A document that shows none is left alone."""
    for layout in LAYOUTS:
        hits = sum(_find(layout.number, r, w, h) is not None and _find(layout.serial, r, w, h) is not None
                   for r, w, h in later_pages)
        if hits and 2 * hits >= len(later_pages):
            return layout
    return None


def _letterhead(row: Row, width: float, height: float) -> bool:
    """Crest fragments and "PRESIDEN" / "REPUBLIK INDONESIA": short, centred, mostly capitals."""
    letters = [c for c in row.text if c.isalpha()]
    return (row.y1 / height <= LETTERHEAD_BAND
            and len(row.text) <= LETTERHEAD_MAX_CHARS
            and abs((row.x0 + row.x1) / 2 - width / 2) <= 0.15 * width
            and sum(c.isupper() for c in letters) >= 0.6 * len(letters))


def edge_rows(rows: list[Row], width: float, height: float, layout: Layout | None,
              first: bool = False) -> Edges:
    """The header and footer rows of a scanned page (top to bottom) of a document in ``layout``:
    everything down to the page number; on the first page, which has no number, the letterhead
    lines above the title; the serial line and below it, and the page-turn word just above it."""
    if layout is None:
        return Edges()
    head: set[int] = set()
    number = _find(layout.number, rows, width, height)
    if number is not None:
        head.update(range(number + 1))
    elif first and layout.title is not None:
        title = _find(layout.title, rows, width, height) or 0
        head.update(i for i in range(title) if _letterhead(rows[i], width, height)
                    or (layout.stamp is not None and layout.stamp.matches(rows[i], width, height)))
    foot: set[int] = set()
    serial = _find(layout.serial, rows, width, height)
    if serial is not None:
        foot.update(range(serial, len(rows)))
        if serial and layout.page_turn.matches(rows[serial - 1], width, height):
            foot.add(serial - 1)
    return Edges(frozenset(head), frozenset(foot))
