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


OCR_LANGUAGE = "ind"
OCR_DPI = 300


def page_lines(pdf: Path, stats: dict | None = None, ocr: bool = True) -> list[list[str]]:
    """Printed lines per page. Scanned pages (a picture filling the page) are read with our own
    OCR (Tesseract ``ind`` through PyMuPDF), not with the text layer that came with the PDF:
    BPK's scans carry someone else's OCR ("2OO2", "REPUBUK"; docs/parser-review-2026-11.md).
    ``stats`` receives ``ocr_pages`` and, when Tesseract is missing, ``ocr_missing``."""
    import pymupdf

    stats = stats if stats is not None else {}
    stats.setdefault("ocr_pages", 0)
    out = []
    with pymupdf.open(pdf) as doc:
        for page in doc:
            words = None
            if ocr and is_scan(page) and not stats.get("ocr_missing"):
                try:
                    tp = page.get_textpage_ocr(language=OCR_LANGUAGE, dpi=OCR_DPI, full=True,
                                               tessdata=tessdata())
                    words = page.get_text("words", textpage=tp)
                    stats["ocr_pages"] += 1
                except Exception as e:  # noqa: BLE001 - no Tesseract or no language data
                    stats["ocr_missing"] = f"{type(e).__name__}: {str(e)[:120]}"
            if words is None:
                words = visible(page, page.get_text("words"))
            out.append(rows(words))
    return out


def visible(page, words: list[tuple]) -> list[tuple]:
    """Leave out characters printed in white: invisible on the page, not part of what was
    published (UU 29/2007 hides "disahkan menjadi Undang-Undang." and "uk" in white, the latter
    glued to the Lembaran Negara number: "93uk"). Pages without white text keep PyMuPDF's words;
    pages with it get words rebuilt from their visible characters."""
    raw = page.get_text("rawdict")["blocks"]
    spans = [s for b in raw for line in b.get("lines", []) for s in line["spans"]]
    if not any(s.get("color") == 0xFFFFFF and "".join(c["c"] for c in s["chars"]).strip() for s in spans):
        return words
    out: list[tuple] = []
    for s in spans:
        if s.get("color") == 0xFFFFFF:
            continue
        cur: list = []
        for ch in s["chars"] + [{"c": " ", "bbox": None}]:
            if ch["c"].isspace():
                if cur:
                    x0 = min(c["bbox"][0] for c in cur)
                    y0 = min(c["bbox"][1] for c in cur)
                    x1 = max(c["bbox"][2] for c in cur)
                    y1 = max(c["bbox"][3] for c in cur)
                    out.append((x0, y0, x1, y1, "".join(c["c"] for c in cur)))
                cur = []
            else:
                cur.append(ch)
    return out


def tessdata() -> str | None:
    """Tesseract's language data: $TESSDATA_PREFIX, else the usual Debian/Ubuntu place."""
    import glob
    import os

    if os.environ.get("TESSDATA_PREFIX"):
        return os.environ["TESSDATA_PREFIX"]
    found = sorted(glob.glob("/usr/share/tesseract-ocr/*/tessdata"))
    return found[-1] if found else None


def is_scan(page) -> bool:
    """A picture covers most of the page (a scanned page, with or without a text layer)."""
    area = page.rect.width * page.rect.height
    for img in page.get_images(full=True):
        for r in page.get_image_rects(img[0]):
            if r.width * r.height > 0.6 * area:
                return True
    return False


def rows(words: list[tuple]) -> list[str]:
    """Words of a page (PyMuPDF ``get_text("words")``) -> printed lines, top to bottom.

    Justified text in many PDFs (BPK's among them) is stored one word per text line, so
    ``get_text()`` returns "Agar" / "setiap" / "orang" … on separate lines and markers at the
    start of a printed line are lost. Words whose vertical centres lie within half a line
    height of each other are one printed line; they are joined left to right."""
    items = sorted(((w[1] + w[3]) / 2, w[0], max(w[3] - w[1], 1.0), w[4]) for w in words if w[4].strip())
    lines: list[list] = []                       # [centre, height, [(x, word), ...]]
    for cy, x, h, word in items:
        if lines and abs(cy - lines[-1][0]) <= 0.5 * min(h, lines[-1][1]):
            lines[-1][2].append((x, word))
        else:
            lines.append([cy, h, [(x, word)]])
    return [" ".join(w for _, w in sorted(ws)) for _, _, ws in lines]


# A page number or the "SK No" serial printed level with a line of text ends up on that line
# ("PPPK. | -7-", "…Nomor 6516), SK No 095251 A '"); OCR adds stray marks ("- 33 - '").
EDGE_NOISE_RE = re.compile(r"(?:\s*\|?\s*(?:-\s*\d{1,4}\s*-|SK\s*No\.?\s*[\d\s]{5,9}\s*[A-Z]?(?:\s*[A-Za-z]{1,2}\b)?)\s*['|.,]*)+$")
LEAD_NOISE_RE = re.compile(r"^(?:-\s*\d{1,4}\s*-\s*['|]*\s*)+(?=\S)")


def _strip_edges(ln: str) -> str:
    ln = re.sub(r"\s+\|\s*$", "", ln)                      # OCR's stray bar ("PENJELASAN |")
    return LEAD_NOISE_RE.sub("", EDGE_NOISE_RE.sub("", ln)).strip()


def _clean_page(raw: list[str], first_page: bool) -> list[str]:
    lines = [_strip_edges(NOISE_RE.sub("", re.sub(r"\s+", " ", ln).strip())) for ln in raw]
    lines = [ln for ln in lines if ln]
    # OCR fragments of the crest ("Pas", "4", "£") stand above the running header: drop short
    # bits there, and only there (a real page can start with a short line such as "1.")
    head = next((k for k, ln in enumerate(lines[:HEADER_ZONE + 4]) if RUNNING_HEADER_RE.match(ln)), 0)
    lines = [ln for k, ln in enumerate(lines)
             if not (k < head and (len(ln) <= 4 or sum(c.isalpha() for c in ln) < 3))]
    # header zone: page numbers, running header, SALINAN stamp, DPR signature boxes
    out: list[str] = []
    in_header = True
    for k, ln in enumerate(lines):
        if in_header and k < HEADER_ZONE + len(HEADER_TOKENS):
            if (ln in HEADER_TOKENS or PAGE_NO_RE.match(ln) or NEVER_CONTENT_RE.match(ln)
                    or ln == "-"):
                continue
            # on page 1 the title block legitimately starts with "PRESIDEN REPUBLIK INDONESIA"
            if not first_page and RUNNING_HEADER_RE.match(ln):
                continue
            if first_page and ln.upper().endswith("SALINAN"):
                continue                                 # stamp
            in_header = False
        out.append(ln)
    # footer zone: trailing page numbers, lone dashes of a split "- 3 -", page-turn words
    while out and (PAGE_NO_RE.match(out[-1]) or out[-1] == "-"):
        out.pop()
    for k in range(len(out) - 1, max(len(out) - 1 - CATCHWORD_ZONE, -1), -1):
        if is_page_turn(out[k]):
            del out[k]
    return [ln for ln in out if not NEVER_CONTENT_RE.match(ln)]


# Page-turn words ("catchwords"): the first words of the next page, printed at the foot of a
# page and ending in an ellipsis: "Pasal 2…", "d. bahwa . . .", "MEMUTUSKAN :..".
PAGE_TURN_ENDINGS = {"…", "….", "...", "....", ":..", ":...", ":…", ":…."}


def is_page_turn(line: str) -> bool:
    """A page-turn word ends in "…" or three dots ("Pasal 2…", "d. bahwa . . .", "MEMUTUSKAN :..");
    a longer run of dots is a form's dot leader and content ("Hari lahir:.............", UU 12/1953)."""
    if len(line) > 70:
        return False
    m = re.search(r"[.…:\s]+$", line)
    if not m or not line[:m.start()].strip():
        return False
    tail = re.sub(r"\s", "", m[0])
    head = line[:m.start()].rstrip()
    # page-turn words are a few words ("Pasal 2", "d. bahwa", "(5) Ketentuan"); a longer line
    # ending in dots is text with a page-turn on the same line, handled by _cut_page_turn_tail
    return tail in PAGE_TURN_ENDINGS and not head.endswith(".") and len(head.split()) <= 4


CATCHWORD_ZONE = 2  # only the last lines of a page


def clean_lines(pages: list[list[str]]) -> list[str]:
    out: list[str] = []
    for k, raw in enumerate(pages):
        out.extend(_clean_page(raw, first_page=(k == 0)))
    # Retyped PDFs do not keep the printed page breaks, so a page-turn word can stand anywhere;
    # it is always followed by the words it announces ("Pasal 15…" / "Pasal 15").
    kept = []
    for i, ln in enumerate(out):
        near = out[max(0, i - 3):i] + out[i + 1:i + 4]
        if is_page_turn(ln) and any(_announces(ln, o) for o in near):
            continue
        kept.append(_cut_page_turn_tail(ln, near))
    return kept


def _cut_page_turn_tail(ln: str, near: list[str]) -> str:
    """A page-turn printed on the same line as text, right-aligned ("… PESAWAT UDARA BAB VI . . .",
    UU 1/2009): cut the last words before the ellipsis when a nearby line starts with them."""
    m = re.search(r"\s*(?:…|\.\s?\.\s?\.)\.?\s*$", ln)
    if not m or ln[:m.start()].rstrip().endswith("."):
        return ln
    words = ln[:m.start()].split()
    for k in range(1, min(5, len(words) - 1) + 1):
        stem = " ".join(words[-k:])
        if len(stem) >= 3 and any(o.replace(" ", "").startswith(stem.replace(" ", "")) for o in near):
            return " ".join(words[:-k])
    return ln


def _announces(catchword: str, nxt: str) -> bool:
    stem = re.sub(r"[\s.…:]+$", "", catchword).strip()
    return len(stem) >= 2 and nxt.replace(" ", "").startswith(stem.replace(" ", ""))
