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


def test_ocr_letters_for_digits_and_spaced_marks_in_headings():
    from hukum_bersih.pdf.structure import normalise

    assert normalise(["Pasal S1", "Pasal 1lA", "Pasal 1O", "Pasal 84 ,", "Pasal 9 ;"]) == [
        "Pasal 51", "Pasal 11A", "Pasal 10", "Pasal 84", "Pasal 9"]
    assert normalise(["Pasal II", "Pasal 5B", "Pasal 84,"]) == ["Pasal II", "Pasal 5B", "Pasal 84,"]


def test_amending_penjelasan_puts_angka_above_ayat():
    from hukum_bersih.akn.bluebell import to_bluebell
    from hukum_bersih.akn.build import to_akn
    from hukum_bersih.pdf.structure import Block, Document

    doc = Document([
        Block("title", text="UNDANG-UNDANG"), Block("pasal", "Pasal I"), Block("text", text="Beberapa ketentuan diubah."),
        Block("pasal", "Pasal II"), Block("text", text="Berlaku."),
        Block("penjelasan", text="PENJELASAN"), Block("pasal_demi_pasal"), Block("p_pasal", "Pasal I"),
        Block("p_label", "Angka 9", "Pasal 77"), Block("p_label", "Ayat (5)", "Cukup jelas."),
        Block("p_label", "Angka 10", "Pasal 78"), Block("p_label", "Ayat (1)", "Cukup jelas."),
    ])
    text = to_bluebell(doc)
    assert "      PARA Angka 10" in text and "        PARA Ayat (1)" in text
    to_akn(text, "/akn/id/act/uu/2022/13", "act")


def test_penjelasan_quoted_in_a_lampiran_after_the_penjelasan_stays_in_the_lampiran():
    from hukum_bersih.pdf.structure import parse_lines

    doc = parse_lines([
        "UNDANG-UNDANG REPUBLIK INDONESIA", "NOMOR 13 TAHUN 2022", "TENTANG", "CONTOH",
        "Pasal 1", "Isi pasal satu.", "Pasal 2", "Undang-Undang ini mulai berlaku.",
        "Disahkan di Jakarta", "pada tanggal 16 Juni 2022",
        "PENJELASAN", "ATAS", "UNDANG-UNDANG REPUBLIK INDONESIA", "I. UMUM", "Umum sekali.",
        "II. PASAL DEMI PASAL", "Pasal 1", "Cukup jelas.", "Pasal 2", "Cukup jelas.",
        "LAMPIRAN I", "TEKNIK PENYUSUNAN", "Contoh:", "PENJELASAN ATAS UNDANG-UNDANG NOMOR 7 TAHUN 2021",
        "Pasal 1", "Cukup jelas.",
    ])
    assert sum(b.kind == "penjelasan" for b in doc.blocks) == 1
    lamp = [b.text for b in doc.blocks if b.kind == "lampiran_text"]
    assert "PENJELASAN ATAS UNDANG-UNDANG NOMOR 7 TAHUN 2021" in lamp and lamp[-1] == "Cukup jelas."


def test_a_record_flagged_by_the_check_is_redone():
    from hukum_bersih.pdf.structure import PARSER_VERSION
    from hukum_bersih.sources.peraturan_bpk import SOURCE, text_current

    rec = {"versions": [{"text": "t.txt", "parser_version": PARSER_VERSION, "pdf_source": SOURCE}]}
    assert text_current(rec)
    assert not text_current({**rec, "recheck": "missed heading in body 3"})


def test_misprinted_heading_numbers_confirmed_by_the_next_heading():
    from hukum_bersih.pdf.structure import parse_lines

    head = ["UNDANG-UNDANG", "NOMOR 19 TAHUN 1948", "TENTANG", "CONTOH"]
    doc = parse_lines(head + ["Pasal 1", "Satu.", "Pasal 2", "Dua.", "Pasal 2", "Tiga.", "Pasal 4", "Empat.",
                              "Pasal II", "Lima.", "Pasal 6", "sebagaimana dimaksud dalam", "Pasal 9",
                              "ayat (1).", "Pasal 7", "Tujuh."])
    labels = [b.label for b in doc.blocks if b.kind == "pasal"]
    assert labels == ["Pasal 1", "Pasal 2", "Pasal 2", "Pasal 4", "Pasal II", "Pasal 6", "Pasal 7"]
    assert any("printed where Pasal 3 belongs" in w for w in doc.warnings)


def test_penjelasan_may_skip_pasal():
    from hukum_bersih.pdf.structure import parse_lines

    doc = parse_lines(["UNDANG-UNDANG", "NOMOR 2 TAHUN 1962", "TENTANG", "CONTOH"]
                      + [x for k in range(1, 14) for x in (f"Pasal {k}", f"Isi {k}.")]
                      + ["Disahkan di Jakarta", "pada tanggal 1 Januari 1962",
                         "PENJELASAN", "UMUM", "Umum.", "PASAL DEMI PASAL", "Pasal 1.", "Cukup jelas.",
                         "Pasal 5.", "Lihat juga", "Pasal 7.", "Pasal 12.", "Cukup jelas", "Pasal 13.", "Jelas."])
    assert [b.label for b in doc.blocks if b.kind == "p_pasal"] == ["Pasal 1", "Pasal 5", "Pasal 12", "Pasal 13"]
