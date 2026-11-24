"""The raw OCR output of scanned pages, kept by the PDF's content so a page is read once, ever.

OCR is the slow step of the pipeline (~1 h for 50 scanned laws on a GitHub runner); the parser
and the spell fix (``ocr_fix.py``, applied later in ``clean_lines``) change far more often. Only
what the engine returned is stored, never anything cleaned, so those changes still apply.

Layout: ``<cache dir>/<engine>/<sha256 of the PDF file>.json.gz``, one file per PDF and engine,
holding every page read so far. The file records ``OCR_CACHE_VERSION`` and ``OCR_DPI``; a file
that differs, or cannot be read, counts as empty and is overwritten by the next save. Bump
``OCR_CACHE_VERSION`` whenever the OCR call changes what an engine returns (model, preprocessing,
engine options). The cache dir is ``$HUKUM_BERSIH_OCR_CACHE`` (``off`` or empty: no cache),
else ``~/.cache/hukum-bersih/ocr``.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import os
import tempfile
from pathlib import Path

OCR_CACHE_VERSION = 1


def cache_dir() -> Path | None:
    value = os.environ.get("HUKUM_BERSIH_OCR_CACHE")
    if value is None:
        return Path.home() / ".cache" / "hukum-bersih" / "ocr"
    return None if value.strip().lower() in ("", "off") else Path(value)


def file_sha256(pdf: Path) -> str:
    h = hashlib.sha256()
    with open(pdf, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def round_words(words: list) -> list[tuple]:
    """(x0, y0, x1, y1, text) of each word or line, coordinates to 0.01 pt: the same shape fresh
    and from the cache, so a cached page gives exactly the lines a fresh read does."""
    return [(round(w[0], 2), round(w[1], 2), round(w[2], 2), round(w[3], 2), w[4]) for w in words]


class OcrCache:
    """The pages of one PDF read by one engine. ``pages`` holds what is on disk; ``add`` + ``save``
    write new pages. Every failure (no dir, unreadable or damaged file, read-only disk) means
    "not cached", never an error."""

    def __init__(self, pdf: Path, engine: str, dpi: int, sha: str | None = None):
        root = cache_dir()
        self.dpi = dpi
        self.engine = engine
        self.path = root / engine / f"{sha or file_sha256(pdf)}.json.gz" if root else None
        self.pages: dict[int, list[tuple]] = self._load()

    def _load(self) -> dict[int, list[tuple]]:
        if not self.path or not self.path.is_file():
            return {}
        try:
            with gzip.open(self.path, "rt", encoding="utf-8") as f:
                data = json.load(f)
            if data["version"] != OCR_CACHE_VERSION or data["dpi"] != self.dpi or data["engine"] != self.engine:
                return {}
            return {int(n): [(a, b, c, d, str(t)) for a, b, c, d, t in words]
                    for n, words in data["pages"].items()}
        except Exception:  # noqa: BLE001 - damaged, truncated or foreign file: read the pages again
            return {}

    def add(self, pages: dict[int, list]) -> dict[int, list[tuple]]:
        pages = {n: round_words(words) for n, words in pages.items()}
        self.pages.update(pages)
        return pages

    def save(self) -> None:
        """Atomic: a temporary file in the same folder, then a rename, so a job that is killed
        mid-write leaves the old file (or none), never half of one."""
        if not self.path:
            return
        tmp = None
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            data = {"version": OCR_CACHE_VERSION, "engine": self.engine, "dpi": self.dpi,
                    "pages": {str(n): self.pages[n] for n in sorted(self.pages)}}
            fd, tmp = tempfile.mkstemp(dir=self.path.parent, prefix=".tmp-", suffix=".gz")
            with os.fdopen(fd, "wb") as raw, gzip.GzipFile(fileobj=raw, mode="wb", mtime=0) as gz:
                gz.write(json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
            os.replace(tmp, self.path)
            tmp = None
        except OSError:
            pass
        finally:
            if tmp:
                try:
                    os.unlink(tmp)
                except OSError:
                    pass
