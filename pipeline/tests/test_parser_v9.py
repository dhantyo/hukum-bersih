"""Parser v9 (2026-11-22): BPK's UU 19/2003 is a web page printed from a browser, and its
Penjelasan is a separate PDF."""

import pymupdf

from hukum_bersih.pdf import extract
from hukum_bersih.pdf.structure import parse_pdf
from hukum_bersih.sources.peraturan_bpk import is_penjelasan


def pdf(path, lines):
    doc = pymupdf.open()
    page = doc.new_page()
    for i, ln in enumerate(lines):
        page.insert_text((72, 72 + 16 * i), ln, fontsize=10)
    doc.save(path)
    return path


def test_browser_print_header_and_footer_are_not_content():
    for junk in ("4/3/24, 9:34 AM UNDANG", "4/3/24, 9:34 AM", "12/31/2024 10:05 PM Some title",
                 "https://jdih.kemenkeu.go.id/FullText/2003/19Tahun2003UU.HTM 24/26",
                 "https://jdih.kemenkeu.go.id/FullText/2003/19Tahun2003UU.HTM"):
        assert extract.NEVER_CONTENT_RE.match(junk), junk
    for text in ("Pasal 1", "pada tanggal 19 Juni 2003", "1/2 dari jumlah anggota",
                 "a. bahwa negara melalui https adalah"):
        assert not extract.NEVER_CONTENT_RE.match(text), text


def test_separate_penjelasan_pdf_is_read_after_the_law(tmp_path):
    law = pdf(tmp_path / "law.pdf", [
        "UNDANG-UNDANG REPUBLIK INDONESIA", "NOMOR 19 TAHUN 2003", "TENTANG", "BADAN USAHA MILIK NEGARA",
        "4/3/24, 9:34 AM UNDANG",
        "Pasal 1", "Dalam Undang-undang ini yang dimaksud dengan BUMN.",
        "Pasal 2", "Undang-undang ini mulai berlaku pada tanggal diundangkan.",
        "https://jdih.kemenkeu.go.id/FullText/2003/19Tahun2003UU.HTM 1/2",
        "Disahkan di Jakarta", "pada tanggal 19 Juni 2003",
    ])
    penj = pdf(tmp_path / "penj.pdf", [
        "PENJELASAN", "ATAS", "UNDANG-UNDANG REPUBLIK INDONESIA", "NOMOR 19 TAHUN 2003",
        "I. UMUM", "Badan Usaha Milik Negara mempunyai peranan penting dalam perekonomian nasional.",
        "II. PASAL DEMI PASAL", "Pasal 1", "Cukup jelas.", "Pasal 2", "Cukup jelas.",
    ])
    alone = parse_pdf(law)
    assert alone.pasal_count == 2
    assert not any(b.kind == "penjelasan" for b in alone.blocks)
    doc = parse_pdf(law, [penj])
    assert doc.pasal_count == 2
    kinds = {b.kind for b in doc.blocks}
    assert "penjelasan" in kinds
    text = " ".join(b.text for b in doc.blocks if b.text)
    assert "9:34" not in text and "kemenkeu" not in text
    assert "peranan penting" in text


def test_penjelasan_files_are_recognised_by_name():
    assert is_penjelasan({"filename": "UU Nomor 19 Tahun 2003_ penjelasan.pdf"})
    assert is_penjelasan({"filename": "PENJELASAN UU 5 2010.pdf"})
    assert not is_penjelasan({"filename": "undang-undang nomor 19 tahun 2003.pdf"})
    assert not is_penjelasan({})


def test_amending_law_is_recognised_from_its_first_pasal():
    from hukum_bersih.pdf.structure import Block, Document

    assert Document([Block("pasal", "Pasal I"), Block("pasal", "Pasal II")]).amending
    assert not Document([Block("pasal", "Pasal 1"), Block("pasal", "Pasal 2")]).amending
    assert not Document([]).amending


def test_ocr_speck_before_a_pasal_heading():
    from hukum_bersih.pdf.structure import normalise

    assert normalise(["' Pasal 8", "‘Pasal 9", ". Pasal 10."]) == ["Pasal 8", "Pasal 9", "Pasal 10"]
    assert normalise(["Pasal 4 :", "Pasal 6'", "Pasal IV :"]) == ["Pasal 4", "Pasal 6", "Pasal IV"]
    assert normalise(["— Pasal 7", "- Pasal 7", "• Pasal 7"]) == ["Pasal 7"] * 3
    assert normalise(["(Pasal 7)"]) == ["(Pasal 7)"]
    assert normalise(["Pasal 5,", "Pasal 5;"]) == ["Pasal 5,", "Pasal 5;"]       # references
    assert normalise(["'Pasal 8 menyatakan bahwa"]) == ["'Pasal 8 menyatakan bahwa"]


def test_keyword_like_word_in_text_is_not_leaked_markup():
    import pytest

    from hukum_bersih.akn.build import LeakedMarkupError, to_akn

    to_akn("BODY\n  ART 1 -\n    TR: Tegangan Rendah\n", "/akn/id/act/uu/2024/59", "act")
    with pytest.raises(LeakedMarkupError):
        to_akn("BODY\n  ART 1 -\n    \\ART 2 - leaked\n", "/akn/id/act/uu/2024/59", "act")


def test_a_new_parser_redoes_only_flagged_or_old_texts():
    from hukum_bersih.pdf.structure import PARSER_REDO_BELOW, PARSER_VERSION
    from hukum_bersih.sources.peraturan_bpk import SOURCE, text_current

    def rec(pv, **flags):
        return {"versions": [{"text": "t.txt", "parser_version": pv, "pdf_source": SOURCE}], **flags}

    assert PARSER_REDO_BELOW < PARSER_VERSION
    assert text_current(rec(PARSER_REDO_BELOW))                      # good older text: kept
    assert not text_current(rec(PARSER_REDO_BELOW - 1))              # too old: redone
    assert not text_current(rec(PARSER_REDO_BELOW, reparse_error=f"v{PARSER_VERSION - 1}: 3 pasal"))
    assert text_current(rec(PARSER_REDO_BELOW, reparse_error=f"v{PARSER_VERSION}: 3 pasal"))
    assert not text_current(rec(PARSER_REDO_BELOW, parse_error="LeakedMarkupError"))
    assert not text_current({"versions": [{"text": "t.txt", "parser_version": PARSER_VERSION,
                                           "pdf_source": "peraturan.go.id"}]})  # not from BPK yet
    assert not text_current({"parser_version_tried": PARSER_VERSION - 1})
    assert text_current({"parser_version_tried": PARSER_VERSION})
