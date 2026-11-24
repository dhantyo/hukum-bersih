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

from .edges import Row, detect_layout, edge_rows
from .ocr_cache import OcrCache, file_sha256
from .ocr_fix import fix_lines

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
    r"|SK\s*N[oa-z9]\.?\s*[0-9A-Z]{5,8}\s*[A-Z]?\W{0,2}"   # OCR: "SK Na 103881 A", "SK No 1039N5 A"
    r"|-\s*\d+\s*-"                                      # page numbers like - 3 -
    r"|(?:www\.)?peraturan\.go\.id"
    r"|(?:www\.)?dpr\.go\.id"
    r"|(?:www\.)?djpp\.depkumham\.go\.id"
    r"|ditjen\s+Peraturan\s+Perundang-undangan"
    r"|file:///\S+"
    # a web page printed from a browser (BPK's UU 19/2003): header "4/3/24, 9:34 AM <page title>",
    # footer "<url> 24/26"
    r"|\d{1,2}/\d{1,2}/\d{2}(?:\d{2})?,?\s+\d{1,2}[:.]\d{2}(?:\s*[AP]M)?(?:\s+.*)?"
    r"|(?:https?|file):/+\S+(?:\s+\d{1,3}\s*/\s*\d{1,3})?"
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
# Which OCR reads scanned pages: "indra" (Indra OCR, the default since 2026-11-23, decision 0012)
# or "tesseract" (Tesseract `ind` through PyMuPDF, used before). Set with $HUKUM_BERSIH_OCR.
# When Indra cannot be loaded (package or model missing), Tesseract reads the pages instead.
OCR_ENGINES = ("indra", "tesseract")


def ocr_engine() -> str:
    import os

    engine = os.environ.get("HUKUM_BERSIH_OCR", "indra").strip().lower()
    if engine not in OCR_ENGINES:
        raise ValueError(f"HUKUM_BERSIH_OCR={engine!r}: expected one of {OCR_ENGINES}")
    return engine


def page_lines(pdf: Path, stats: dict | None = None, ocr: bool = True) -> list[list[str]]:
    """Printed lines per page. Scanned pages (a picture filling the page) are read with our own
    OCR (``ocr_engine()``), not with the text layer that came with the PDF: BPK's scans carry
    someone else's OCR ("2OO2", "REPUBUK"; docs/parser-review-2026-11.md). ``stats`` receives
    ``ocr_pages``, ``ocr_engine`` (the engine that read them), ``ocr_cached`` (how many of those
    pages came from the OCR cache, ``ocr_cache.py``, instead of being read again) and, when no
    OCR could run, ``ocr_missing``. Only the engine's raw output is cached; cleaning and the
    spell fix run on it every time."""
    import pymupdf

    stats = stats if stats is not None else {}
    stats.setdefault("ocr_pages", 0)
    stats.setdefault("ocr_cached", 0)
    stats.setdefault("edge_lines", [])
    stats.setdefault("edge_at", [])                  # the same lines with their page: (page, text)
    with pymupdf.open(pdf) as doc:
        scans = [p.number for p in doc if ocr and is_scan(p)] if not stats.get("ocr_missing") else []
        read: dict[int, list] = {}
        if scans:
            engines = [ocr_engine()]
            if engines[0] == "indra":
                engines.append("tesseract")          # fallback when Indra cannot be loaded
            errors = []
            sha = file_sha256(pdf)
            for engine in engines:
                try:
                    cache = OcrCache(pdf, engine, OCR_DPI, sha)
                    read = {n: cache.pages[n] for n in scans if n in cache.pages}
                    missing = [n for n in scans if n not in read]
                    if missing:                          # only these go to the OCR workers
                        try:
                            fresh = ocr_pages(pdf, missing, engine)
                        except Exception:  # noqa: BLE001 - the worker processes failed: one at a time
                            fresh = dict(_ocr_chunk(str(pdf), missing, engine))
                        read.update(cache.add(fresh))
                        cache.save()
                    stats["ocr_pages"] += len(read)
                    stats["ocr_cached"] += len(scans) - len(missing)
                    stats["ocr_engine"] = engine
                    if errors:
                        stats["ocr_fallback"] = errors[0]
                    break
                except Exception as e:  # noqa: BLE001 - engine, model or language data missing
                    errors.append(f"{engine}: {type(e).__name__}: {str(e)[:120]}")
            else:
                stats["ocr_missing"] = "; ".join(errors)
        stats["ocr_scanned"] = sorted(read)              # for clean_lines: pages to spell-fix
        # Header and footer of scanned pages are cut by position (edges.py), only in a layout
        # the document's own pages show. ``edge_head``: pages whose header that took off, which
        # clean_lines then does not look at again.
        boxes = {n: (row_boxes(words), doc[n].rect.width, doc[n].rect.height) for n, words in read.items()}
        layout = detect_layout([b for n, b in boxes.items() if n > 0])
        stats["edge_head"] = []
        out = []
        for p in doc:
            if p.number not in read:
                out.append(rows(visible(p, p.get_text("words"))))
                continue
            page_rows, width, height = boxes[p.number]
            edges = edge_rows(page_rows, width, height, layout, first=p.number == 0)
            stats["edge_lines"] += [page_rows[i].text for i in sorted(edges.gone)]
            stats["edge_at"] += [(p.number + 1, page_rows[i].text) for i in sorted(edges.gone)]
            if edges.head:
                stats["edge_head"].append(p.number)
            out.append([r.text for i, r in enumerate(page_rows) if i not in edges.gone])
        return out


def ocr_pages(pdf: Path, numbers: list[int], engine: str = "tesseract") -> dict[int, list]:
    """OCR words (Tesseract) or lines (Indra) for the given pages, read in parallel: one process
    per CPU core, each engine kept to one thread (Tesseract ~2.6 s a page; scans have 20-350
    pages). The result is the same as reading the pages one after another."""
    import os
    from concurrent.futures import ProcessPoolExecutor
    from multiprocessing import get_context

    workers = min(os.cpu_count() or 1, len(numbers))
    if workers <= 1:
        return dict(_ocr_chunk(str(pdf), numbers, engine))
    chunks = [numbers[i::workers] for i in range(workers)]
    # "fork": the workers do not re-import the calling script ("spawn" does, and fails when the
    # script has no `if __name__ == "__main__"` guard); this process holds no other threads
    with ProcessPoolExecutor(workers, mp_context=get_context("fork"), initializer=_one_thread) as pool:
        return {n: w for part in pool.map(_ocr_chunk, [str(pdf)] * workers, chunks, [engine] * workers)
                for n, w in part}


def _one_thread() -> None:
    import os

    os.environ["OMP_THREAD_LIMIT"] = "1"
    os.environ["OMP_NUM_THREADS"] = "1"


def _ocr_chunk(pdf: str, numbers: list[int], engine: str = "tesseract") -> list[tuple[int, list]]:
    import pymupdf

    out = []
    with pymupdf.open(pdf) as doc:
        if engine == "indra":
            conv = _indra()
            for n in numbers:
                out.append((n, _indra_lines(conv, doc[n])))
            return out
        for n in numbers:
            page = doc[n]
            tp = page.get_textpage_ocr(language=OCR_LANGUAGE, dpi=OCR_DPI, full=True, tessdata=tessdata())
            out.append((n, [tuple(w) for w in page.get_text("words", textpage=tp)]))
    return out


_INDRA = None


def _indra():
    """Indra OCR (datalab-to/indra, Apache-2.0 code, OpenRAIL-M weights; decision 0012), loaded
    once per process with one thread (the pages are spread over processes). Its models come from
    Hugging Face on first use (about 76 MB) or from $INDRA_OCR_MODEL_DIR."""
    global _INDRA
    if _INDRA is None:
        import indra_ocr

        _INDRA = indra_ocr.load(threads=1, mode="ocr")
    return _INDRA


def _indra_lines(conv, page) -> list[tuple]:
    """Indra's lines of a page as (x0, y0, x1, y1, text) in page coordinates, the shape of
    PyMuPDF's words, so ``rows`` joins lines printed level with each other ("Menimbang" and
    ": a. bahwa ...") as it joins words."""
    import numpy as np
    import pymupdf

    pix = page.get_pixmap(dpi=OCR_DPI, colorspace=pymupdf.csGRAY, alpha=False)
    gray = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.stride)[:, : pix.width]
    scale = 72 / OCR_DPI
    out = []
    for line in conv.ocr(np.ascontiguousarray(gray)).lines:
        if not line.text.strip():
            continue
        x0, y0, x1, y1 = line.box
        out.append((x0 * scale, y0 * scale, x1 * scale, y1 * scale, line.text))
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
    return [r.text for r in row_boxes(words)]


def row_boxes(words: list[tuple]) -> list[Row]:
    """``rows`` with each printed line's box."""
    items = sorted(((w[1] + w[3]) / 2, w[0], max(w[3] - w[1], 1.0), w) for w in words if w[4].strip())
    lines: list[list] = []                       # [centre, height, [word, ...]]
    for cy, _, h, w in items:
        if lines and abs(cy - lines[-1][0]) <= 0.5 * min(h, lines[-1][1]):
            lines[-1][2].append(w)
        else:
            lines.append([cy, h, [w]])
    out = []
    for _, _, ws in lines:
        ws.sort(key=lambda w: w[0])
        out.append(Row(min(w[0] for w in ws), min(w[1] for w in ws), max(w[2] for w in ws),
                       max(w[3] for w in ws), " ".join(w[4] for w in ws)))
    return out


# A page number or the "SK No" serial printed level with a line of text ends up on that line
# ("PPPK. | -7-", "…Nomor 6516), SK No 095251 A '"); OCR adds stray marks ("- 33 - '").
EDGE_NOISE_RE = re.compile(r"(?:\s*\|?\s*(?:-\s*\d{1,4}\s*-|SK\s*No\.?\s*[\d\s]{5,9}\s*[A-Z]?(?:\s*[A-Za-z]{1,2}\b)?)\s*['|.,]*)+$")
LEAD_NOISE_RE = re.compile(r"^(?:-\s*\d{1,4}\s*-\s*['|]*\s*)+(?=\S)")


def _strip_edges(ln: str) -> str:
    ln = re.sub(r"^\|\s+|\s+\|\s*$", "", ln)               # OCR's stray bar ("PENJELASAN |", "| Pasal 1")
    return LEAD_NOISE_RE.sub("", EDGE_NOISE_RE.sub("", ln)).strip()


def _clean_page(raw: list[str], first_page: bool, header_cut: bool = False) -> list[str]:
    """``header_cut``: the running header is already gone (cut by position, ``edges.py``), so
    its text rules are not applied: a "PRESIDEN REPUBLIK INDONESIA" now at the top is the law's
    own enacting formula, and the short lines above it ("dan") are law text too."""
    lines = [_strip_edges(NOISE_RE.sub("", re.sub(r"\s+", " ", ln).strip())) for ln in raw]
    lines = [ln for ln in lines if ln]
    # OCR fragments of the crest ("Pas", "4", "£") stand above the running header: drop short
    # bits there, and only there (a real page can start with a short line such as "1.")
    head = 0 if header_cut else next(
        (k for k, ln in enumerate(lines[:HEADER_ZONE + 4]) if RUNNING_HEADER_RE.match(ln)), 0)
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
            if not first_page and not header_cut and RUNNING_HEADER_RE.match(ln):
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


def clean_lines(pages: list[list[str]], stats: dict | None = None) -> list[str]:
    """``stats`` from ``page_lines``: misread words of its OCR'd pages (``ocr_scanned``) are
    corrected (ocr_fix.py) once headers and page numbers are gone, so they are judged on the
    law's own words; the result is added to ``ocr_fixes`` (one per PDF)."""
    cut = set((stats or {}).get("edge_head") or [])
    cleaned = [_clean_page(raw, first_page=(k == 0), header_cut=k in cut) for k, raw in enumerate(pages)]
    scanned = (stats or {}).get("ocr_scanned") or []
    if scanned:
        fixed, fixes = fix_lines([ln for n in scanned for ln in cleaned[n]])
        stats.setdefault("ocr_fixes", []).append(fixes)
        for n in scanned:
            cleaned[n], fixed = fixed[:len(cleaned[n])], fixed[len(cleaned[n]):]
    out = [ln for page in cleaned for ln in page]
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
