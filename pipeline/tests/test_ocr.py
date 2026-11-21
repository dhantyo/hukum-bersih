"""Scanned pages are read with our OCR; typed pages keep their text; no Tesseract -> fallback."""

import pymupdf

from hukum_bersih.pdf import extract


def typed_pdf(path):
    doc = pymupdf.open()
    doc.new_page().insert_text((72, 72), "Pasal 1")
    doc.save(path)
    return path


def scanned_pdf(path):
    """A page that is one picture of text (plus a text layer that says something else)."""
    src = pymupdf.open()
    src.new_page().insert_text((72, 100), "Pasal 1", fontsize=14, fontname="tiro")
    pix = src[0].get_pixmap(dpi=300)
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_image(page.rect, pixmap=pix)
    page.insert_text((72, 72), "Pasal l", render_mode=3)          # someone else's OCR layer
    doc.save(path)
    return path


def test_typed_pages_are_not_ocrd(tmp_path):
    stats = {}
    assert extract.page_lines(typed_pdf(tmp_path / "t.pdf"), stats) == [["Pasal 1"]]
    assert stats["ocr_pages"] == 0


def test_scans_fall_back_to_the_text_layer_without_tesseract(tmp_path, monkeypatch):
    def no_tesseract(self, **k):
        raise RuntimeError("No tessdata specified")

    monkeypatch.setattr(pymupdf.Page, "get_textpage_ocr", no_tesseract)
    stats = {}
    lines = extract.page_lines(scanned_pdf(tmp_path / "s.pdf"), stats)
    assert lines == [["Pasal l"]] and stats["ocr_pages"] == 0 and "tessdata" in stats["ocr_missing"]


def test_scans_are_read_with_ocr_when_available(tmp_path):
    import pytest

    if not extract.tessdata():
        pytest.skip("Tesseract language data not installed")
    stats = {}
    lines = extract.page_lines(scanned_pdf(tmp_path / "s.pdf"), stats)
    assert stats["ocr_pages"] == 1 and lines[0] == ["Pasal 1"]
