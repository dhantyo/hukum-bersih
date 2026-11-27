"""Scanned pages are read with our OCR; typed pages keep their text; no Tesseract -> fallback."""

import pymupdf

from hukum_rapih.pdf import extract


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

    def no_indra():
        raise ModuleNotFoundError("No module named 'indra_ocr'")

    monkeypatch.setattr(pymupdf.Page, "get_textpage_ocr", no_tesseract)
    monkeypatch.setattr(extract, "_indra", no_indra)             # no OCR engine at all
    monkeypatch.delenv("HUKUM_RAPIH_OCR", raising=False)
    stats = {}
    lines = extract.page_lines(scanned_pdf(tmp_path / "s.pdf"), stats)
    assert lines == [["Pasal l"]] and stats["ocr_pages"] == 0 and "tessdata" in stats["ocr_missing"]
    assert "indra_ocr" in stats["ocr_missing"]


def test_scans_are_read_with_ocr_when_available(tmp_path):
    import pytest

    if not extract.tessdata():
        pytest.skip("Tesseract language data not installed")
    stats = {}
    lines = extract.page_lines(scanned_pdf(tmp_path / "s.pdf"), stats)
    assert stats["ocr_pages"] == 1 and lines[0] == ["Pasal 1"]


def test_engine_is_chosen_by_environment(tmp_path, monkeypatch):
    used = []
    monkeypatch.setattr(extract, "_ocr_chunk", lambda pdf, nums, engine="tesseract": used.append(engine) or [(n, [(72, 90, 120, 104, "Pasal 1")]) for n in nums])
    monkeypatch.setattr(extract, "ocr_pages", lambda pdf, nums, engine="tesseract": dict(extract._ocr_chunk(str(pdf), nums, engine)))
    for value, expected in [("tesseract", "tesseract"), ("indra", "indra"), (None, "indra")]:
        if value is None:
            monkeypatch.delenv("HUKUM_RAPIH_OCR", raising=False)
        else:
            monkeypatch.setenv("HUKUM_RAPIH_OCR", value)
        stats = {}
        assert extract.page_lines(scanned_pdf(tmp_path / "s.pdf"), stats) == [["Pasal 1"]]
        assert stats["ocr_engine"] == expected and used[-1] == expected


def test_tesseract_reads_when_indra_cannot_load(tmp_path, monkeypatch):
    def chunk(pdf, nums, engine="tesseract"):
        if engine == "indra":
            raise ModuleNotFoundError("No module named 'indra_ocr'")
        return [(n, [(72, 90, 120, 104, "Pasal 1")]) for n in nums]

    monkeypatch.delenv("HUKUM_RAPIH_OCR", raising=False)
    monkeypatch.setattr(extract, "_ocr_chunk", chunk)
    monkeypatch.setattr(extract, "ocr_pages", lambda pdf, nums, engine="tesseract": dict(chunk(str(pdf), nums, engine)))
    stats = {}
    assert extract.page_lines(scanned_pdf(tmp_path / "s.pdf"), stats) == [["Pasal 1"]]
    assert stats["ocr_engine"] == "tesseract" and "indra_ocr" in stats["ocr_fallback"]


def test_unknown_engine_is_refused(monkeypatch):
    import pytest

    monkeypatch.setenv("HUKUM_RAPIH_OCR", "easyocr")
    with pytest.raises(ValueError, match="easyocr"):
        extract.ocr_engine()


def test_scans_are_read_with_indra_when_installed(tmp_path, monkeypatch):
    import pytest

    pytest.importorskip("indra_ocr")
    monkeypatch.delenv("HUKUM_RAPIH_OCR", raising=False)
    stats = {}
    lines = extract.page_lines(scanned_pdf(tmp_path / "s.pdf"), stats)
    assert stats["ocr_engine"] == "indra" and stats["ocr_pages"] == 1 and lines[0] == ["Pasal 1"]


def test_engine_named_in_the_version():
    from hukum_rapih.sources.peraturan_go_id import _ocr_engine

    assert _ocr_engine(["salinan: left out", "ocr: 3 scanned page(s) read with indra"]) == "indra"
