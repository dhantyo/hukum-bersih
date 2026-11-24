"""A scanned page is OCR'd once: the engine's raw output is kept by the PDF's content."""

import gzip
import json

import pymupdf
import pytest
from test_ocr import scanned_pdf, typed_pdf

from hukum_bersih.pdf import extract, ocr_cache


@pytest.fixture
def engine_calls(monkeypatch):
    """A fake OCR engine that records which pages it is asked to read."""
    calls = []

    def chunk(pdf, nums, engine="tesseract"):
        calls.append((engine, list(nums)))
        return [(n, [(72.123456, 90.0, 120.0, 104.0, f"Pasal {n + 1}")]) for n in nums]

    monkeypatch.setattr(extract, "_ocr_chunk", chunk)
    monkeypatch.setattr(extract, "ocr_pages", lambda pdf, nums, engine="tesseract": dict(chunk(str(pdf), nums, engine)))
    monkeypatch.setenv("HUKUM_BERSIH_OCR", "tesseract")
    return calls


def cache_files(tmp_path):
    return sorted((tmp_path / "ocr-cache").rglob("*.json.gz"))


def test_second_read_does_not_call_the_engine(tmp_path, engine_calls):
    pdf = scanned_pdf(tmp_path / "s.pdf")
    first, second = {}, {}
    lines = extract.page_lines(pdf, first)
    assert extract.page_lines(pdf, second) == lines == [["Pasal 1"]]
    assert len(engine_calls) == 1
    assert (first["ocr_pages"], first["ocr_cached"]) == (1, 0)
    # a law read entirely from the cache was still read with the engine
    assert (second["ocr_pages"], second["ocr_cached"], second["ocr_engine"]) == (1, 1, "tesseract")
    assert second["ocr_scanned"] == [0]                  # clean_lines still spell-fixes it
    assert len(cache_files(tmp_path)) == 1


def test_only_missing_pages_are_read(tmp_path, engine_calls):
    pdf = tmp_path / "two.pdf"
    scanned_pdf(tmp_path / "one.pdf")
    src = pymupdf.open(tmp_path / "one.pdf")
    doc = pymupdf.open()
    doc.insert_pdf(src)
    doc.insert_pdf(src)
    doc.save(pdf)
    cache = ocr_cache.OcrCache(pdf, "tesseract", extract.OCR_DPI)
    cache.add({0: [(72, 90, 120, 104, "Pasal 1")]})
    cache.save()
    stats = {}
    assert extract.page_lines(pdf, stats) == [["Pasal 1"], ["Pasal 2"]]
    assert engine_calls == [("tesseract", [1])]
    assert (stats["ocr_pages"], stats["ocr_cached"]) == (2, 1)
    extract.page_lines(pdf)
    assert len(engine_calls) == 1                         # now both are cached


def test_another_engine_or_pdf_misses(tmp_path, engine_calls, monkeypatch):
    pdf = scanned_pdf(tmp_path / "s.pdf")
    extract.page_lines(pdf)
    monkeypatch.setenv("HUKUM_BERSIH_OCR", "indra")
    stats = {}
    extract.page_lines(pdf, stats)
    assert [e for e, _ in engine_calls] == ["tesseract", "indra"] and stats["ocr_cached"] == 0
    other = tmp_path / "other.pdf"                        # same pages, different bytes
    doc = pymupdf.open(pdf)
    doc.set_metadata({"title": "changed"})
    doc.save(other)
    stats = {}
    extract.page_lines(other, stats)
    assert len(engine_calls) == 3 and stats["ocr_cached"] == 0
    assert len(cache_files(tmp_path)) == 3


def test_changed_version_or_dpi_misses(tmp_path, engine_calls, monkeypatch):
    pdf = scanned_pdf(tmp_path / "s.pdf")
    extract.page_lines(pdf)
    monkeypatch.setattr(ocr_cache, "OCR_CACHE_VERSION", ocr_cache.OCR_CACHE_VERSION + 1)
    extract.page_lines(pdf)
    assert len(engine_calls) == 2
    monkeypatch.setattr(extract, "OCR_DPI", extract.OCR_DPI + 100)
    extract.page_lines(pdf)
    assert len(engine_calls) == 3
    assert len(cache_files(tmp_path)) == 1                # overwritten, the cache does not pile up


@pytest.mark.parametrize("damage", [b"", b"not gzip at all", gzip.compress(b"{not json"),
                                    gzip.compress(b'{"version": 1}'), gzip.compress(b"[]")])
def test_corrupt_file_is_ignored_and_rewritten(tmp_path, engine_calls, damage):
    pdf = scanned_pdf(tmp_path / "s.pdf")
    extract.page_lines(pdf)
    (path,) = cache_files(tmp_path)
    path.write_bytes(damage)
    assert extract.page_lines(pdf) == [["Pasal 1"]]
    assert len(engine_calls) == 2
    stats = {}
    extract.page_lines(pdf, stats)
    assert len(engine_calls) == 2 and stats["ocr_cached"] == 1      # rewritten, readable again


def test_typed_pages_never_touch_the_cache(tmp_path, engine_calls):
    stats = {}
    assert extract.page_lines(typed_pdf(tmp_path / "t.pdf"), stats) == [["Pasal 1"]]
    assert stats["ocr_cached"] == 0 and engine_calls == []
    assert not (tmp_path / "ocr-cache").exists()


def test_cache_keeps_only_raw_engine_output(tmp_path, engine_calls):
    extract.page_lines(scanned_pdf(tmp_path / "s.pdf"))
    (path,) = cache_files(tmp_path)
    assert path.parent.name == "tesseract" and path.name == ocr_cache.file_sha256(tmp_path / "s.pdf") + ".json.gz"
    data = json.loads(gzip.decompress(path.read_bytes()))
    assert data["pages"] == {"0": [[72.12, 90.0, 120.0, 104.0, "Pasal 1"]]}


def test_save_is_atomic(tmp_path, engine_calls, monkeypatch):
    pdf = scanned_pdf(tmp_path / "s.pdf")
    extract.page_lines(pdf)
    (path,) = cache_files(tmp_path)
    before = path.read_bytes()
    cache = ocr_cache.OcrCache(pdf, "tesseract", extract.OCR_DPI)
    cache.add({7: [(1, 2, 3, 4, "x")]})

    def killed(src, dst):
        raise OSError("killed")

    monkeypatch.setattr(ocr_cache.os, "replace", killed)
    cache.save()                                          # a failed save never raises ...
    assert path.read_bytes() == before                    # ... leaves the old file intact ...
    assert [p.name for p in path.parent.iterdir()] == [path.name]   # ... and no temporary file


def test_cache_can_be_switched_off(tmp_path, engine_calls, monkeypatch):
    monkeypatch.setenv("HUKUM_BERSIH_OCR_CACHE", "off")
    pdf = scanned_pdf(tmp_path / "s.pdf")
    extract.page_lines(pdf)
    extract.page_lines(pdf)
    assert len(engine_calls) == 2 and cache_files(tmp_path) == []


def test_default_location(monkeypatch, tmp_path):
    monkeypatch.delenv("HUKUM_BERSIH_OCR_CACHE")
    monkeypatch.setenv("HOME", str(tmp_path))
    assert ocr_cache.cache_dir() == tmp_path / ".cache" / "hukum-bersih" / "ocr"
