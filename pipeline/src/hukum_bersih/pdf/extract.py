"""PDF -> cleaned physical lines: page headers, page numbers, footers, watermarks and DPR
signature boxes removed. Structure detection happens in ``structure.py``.

The header/footer rules for peraturan.go.id PDFs are ported from Pasal.id's
``scripts/parser/extract_pymupdf.py`` (https://github.com/ilhamfp/pasal, AGPL-3.0), which
handles the running "PRESIDEN REPUBLIK INDONESIA" header and its OCR variants, page numbers
("- 2 -", "-2-", "2"), gazette headers ("2022, No.4"), watermarks and print stamps.
"""

from __future__ import annotations

import re
from pathlib import Path

# Signature boxes printed on every page of DPR "draft final" documents.
HEADER_TOKENS = {
    "F", "FP", "PDIP", "FPG", "GERINDRA", "FPKB", "NASDEM", "PAN", "PKS", "FPD", "PEMERINTAH",
    "F PDIP", "FP GERINDRA", "FP NASDEM", "F PAN", "F PKS", "GERINDRA FPKB",
}
PAGE_NO_RE = re.compile(r"^-?\s*\d{1,4}\s*-?$")                 # "- 2 -", "-2-", "2"
# Banner that peraturan.go.id printed into some HTML-converted PDFs (old laws).
NOISE_RE = re.compile(
    r"^Teks tidak dalam format asli\.?\s*Kembali:?\s*tekan backspace\s*\S*\s*", re.IGNORECASE
)
# Lines that are never content, wherever they appear on a page (after Pasal.id).
NEVER_CONTENT_RE = re.compile(
    r"^(?:"
    r"Halaman\s+\d+\s+dari\s+\d+"
    r"|SK\s+No\s*[\d'\s]+[A-Z]?"
    r"|-\s*\d+\s*-"                                      # page numbers like - 3 -
    r"|(?:www\.)?peraturan\.go\.id"
    r"|(?:www\.)?dpr\.go\.id"
    r"|(?:www\.)?djpp\.depkumham\.go\.id"
    r"|ditjen\s+Peraturan\s+Perundang-undangan"
    r"|file:///\S+"
    r"|\d{1,2}/\d{1,2}/\d{4}\s+\d{1,2}:\d{2}\s*(?:AM|PM)?"
    r"|\d+\s+of\s+\d+"
    r"|\d{4},\s*No\.\s*\d+"                              # gazette header "2022, No.4"
    r")$",
    re.IGNORECASE,
)
# Running header on pages 2+: "PRESIDEN" / "REPUBLIK INDONESIA", including OCR variants
# (FRESIDEN, PRES IDEN, REPUEUK, TNDONESIA, ...). Only removed in a page's header zone.
RUNNING_HEADER_RE = re.compile(
    r"^(?:SALINAN"
    r"|[FP]RE\s*S\s*I\s*DEN"
    r"|(?:RE|NE|RF)\w+\s+(?:IN|TN)\w+"
    r"|(?:[FP]RE\s*S\s*I\s*DEN|PRES\s+IDEN)\s+(?:RE|NE|RF)\w+\s+(?:IN|TN)\w+"
    r")$",
    re.IGNORECASE,
)
HEADER_ZONE = 5  # lines at the top of a page that may hold headers


def page_lines(pdf: Path) -> list[list[str]]:
    import pymupdf

    with pymupdf.open(pdf) as doc:
        return [page.get_text().splitlines() for page in doc]


def _clean_page(raw: list[str], first_page: bool) -> list[str]:
    lines = [NOISE_RE.sub("", re.sub(r"\s+", " ", ln).strip()) for ln in raw]
    lines = [ln for ln in lines if ln]
    # header zone: page numbers, running header, SALINAN stamp, DPR signature boxes
    out: list[str] = []
    in_header = True
    for k, ln in enumerate(lines):
        if in_header and k < HEADER_ZONE + len(HEADER_TOKENS):
            if ln in HEADER_TOKENS or PAGE_NO_RE.match(ln) or NEVER_CONTENT_RE.match(ln):
                continue
            # on page 1 the title block legitimately starts with "PRESIDEN REPUBLIK INDONESIA"
            if not first_page and RUNNING_HEADER_RE.match(ln):
                continue
            if first_page and ln.upper() == "SALINAN":
                continue
            in_header = False
        out.append(ln)
    # footer zone: trailing page numbers
    while out and PAGE_NO_RE.match(out[-1]):
        out.pop()
    return [ln for ln in out if not NEVER_CONTENT_RE.match(ln)]


def clean_lines(pages: list[list[str]]) -> list[str]:
    out: list[str] = []
    for k, raw in enumerate(pages):
        out.extend(_clean_page(raw, first_page=(k == 0)))
    return out
