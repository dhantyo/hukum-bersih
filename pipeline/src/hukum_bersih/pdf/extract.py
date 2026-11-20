"""PDF -> cleaned physical lines: page headers, page numbers, footers and DPR signature
boxes removed. Structure detection happens in ``structure.py``."""

from __future__ import annotations

import re
from pathlib import Path

# Signature boxes printed on every page of DPR "draft final" documents.
HEADER_TOKENS = {
    "F", "FP", "PDIP", "FPG", "GERINDRA", "FPKB", "NASDEM", "PAN", "PKS", "FPD", "PEMERINTAH",
    "F PDIP", "FP GERINDRA", "FP NASDEM", "F PAN", "F PKS", "GERINDRA FPKB",
}
PAGE_NO_RE = re.compile(r"^(?:-\s*)?\d{1,3}(?:\s*-)?$")
FOOTER_RE = re.compile(r"^(?:www\.peraturan\.go\.id|www\.dpr\.go\.id|\d{4}, No\.\s*\d+)$", re.IGNORECASE)


def page_lines(pdf: Path) -> list[list[str]]:
    import pymupdf

    with pymupdf.open(pdf) as doc:
        return [page.get_text().splitlines() for page in doc]


def clean_lines(pages: list[list[str]]) -> list[str]:
    out: list[str] = []
    for raw in pages:
        lines = [re.sub(r"\s+", " ", ln).strip() for ln in raw]
        lines = [ln for ln in lines if ln]
        while lines and (lines[0] in HEADER_TOKENS or PAGE_NO_RE.match(lines[0])):
            lines.pop(0)
        while lines and (PAGE_NO_RE.match(lines[-1]) or FOOTER_RE.match(lines[-1])):
            lines.pop()
        out.extend(ln for ln in lines if not FOOTER_RE.match(ln))
    return out
