"""Page furniture (headers, page numbers, serials, page-turn words, crest fragments, browser print
marks) left out of the text, with lines as printed in the sample PDFs (docs/parser-review-2026-11.md)."""

import pytest

from hukum_bersih.pdf import extract
from hukum_bersih.pdf.extract import _clean_page, rows


def test_words_on_one_printed_line_are_joined():
    # BPK's justified text: one word per text line in the PDF, same baseline on the page
    words = [(100, 500, 120, 510, "Agar"), (125, 500, 150, 510, "setiap"), (155, 501, 180, 511, "orang"),
             (100, 520, 160, 530, "Disahkan"), (165, 520, 190, 530, "di")]
    assert rows(words) == ["Agar setiap orang", "Disahkan di"]


def test_page_turn_words_and_split_page_numbers_are_dropped():
    page = ["PRESIDEN", "REPUBLIK INDONESIA", "-", "3", "-", "Pasal 2", "Isi pasal.", "Pasal 3…"]
    assert _clean_page(page, first_page=False) == ["Pasal 2", "Isi pasal."]
    assert _clean_page(["teks", "d. bahwa . . ."], first_page=False) == ["teks"]
    assert _clean_page(["teks", "MEMUTUSKAN :.."], first_page=False) == ["teks"]


def test_page_turn_words_in_the_middle_of_a_pdf_page():           # UU 19/2001, UU 12/1964
    from hukum_bersih.pdf.extract import clean_lines

    lines = clean_lines([["teks a", "Pasal 15…", "Pasal 15", "(1) Setelah", "teks b", "Ayat (4) …", "Ayat (4)",
                          "Cukup jelas", "x"], ["teks", "Pasal 7…."]])
    assert lines == ["teks a", "Pasal 15", "(1) Setelah", "teks b", "Ayat (4)", "Cukup jelas", "x", "teks"]
    # an ellipsis that announces nothing stays (it may be text)
    assert clean_lines([["dan seterusnya …", "Pasal 2", "x"]]) == ["dan seterusnya …", "Pasal 2", "x"]


def test_page_turn_word_just_after_its_heading():                  # UU 1/2009
    from hukum_bersih.pdf.extract import clean_lines

    assert clean_lines([["BAB VI", "RANCANG BANGUN", "BAB VI...", "Bagian Kesatu"]]) == [
        "BAB VI", "RANCANG BANGUN", "Bagian Kesatu"]


def test_page_turn_on_the_same_line_as_text():                     # UU 1/2009
    from hukum_bersih.pdf.extract import clean_lines

    assert clean_lines([["BAB VI", "RANCANG BANGUN DAN PRODUKSI PESAWAT UDARA BAB VI . . .", "Bagian Kesatu"]]) == [
        "BAB VI", "RANCANG BANGUN DAN PRODUKSI PESAWAT UDARA", "Bagian Kesatu"]
    assert clean_lines([["sanksi administratif berupa: (2) Setiap...", "(2) Setiap orang"]]) == [
        "sanksi administratif berupa:", "(2) Setiap orang"]
    assert clean_lines([["x", "dan seterusnya ...", "lain", "y", "z"]]) == ["x", "dan seterusnya ...", "lain", "y", "z"]


def test_form_dot_leaders_are_not_page_turn_words():               # UU 12/1953
    form = ["teks", "Hari lahir:.............Tempat kelahiran:.....", "Di............................"]
    assert _clean_page(form, first_page=False) == form
    assert _clean_page(["teks", "Pasal 7…."], first_page=False) == ["teks"]


def test_crest_fragments_above_the_header_only():                  # UU 18/2025 (scan)
    assert _clean_page(["Pas", "4", "£", "(53", "PRESIDEN", "REPUBLIK INDONESIA", "-3-", "PasalI", "x."],
                       first_page=False) == ["PasalI", "x."]
    assert _clean_page(["1.", "Propinsi Kalimantan-Barat, yang", "teks"], first_page=False) == [
        "1.", "Propinsi Kalimantan-Barat, yang", "teks"]


def test_page_numbers_and_serials_on_a_text_line():               # UU 20/2023, UU 6/2021, UU 36/2014
    assert _clean_page(["teks", "PPPK. | -7-", "Nomor 6516), SK No 095251 A '", "- 33 - ' (2) Proses evaluasi",
                        "Defence): SK No 048550A ag"], first_page=False) == [
        "teks", "PPPK.", "Nomor 6516),", "(2) Proses evaluasi", "Defence):"]
    assert _clean_page(["teks", "Rp 1.000.000,- (satu juta rupiah)."], first_page=False)[1] == \
        "Rp 1.000.000,- (satu juta rupiah)."


def test_ocr_serials_and_bars():                                      # UU 2/2021, UU 24/2022
    page = ["teks", "SK Na 103881 A", "| Pasal 1", "SK No 1039N5 A", "SK Ng 103884 A", "isi"]
    assert _clean_page(page, first_page=False) == ["teks", "Pasal 1", "isi"]


def test_white_text_is_left_out(tmp_path):                         # UU 29/2007
    import pymupdf

    from hukum_bersih.pdf.extract import page_lines

    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((72, 100), "NOMOR 93")
    page.insert_text((128.7, 100), "uk", color=(1, 1, 1))           # glued to the number, in white
    page.insert_text((72, 130), "disahkan menjadi Undang-Undang.", color=(1, 1, 1))
    page.insert_text((72, 160), "Salinan")
    doc.save(tmp_path / "w.pdf")
    assert page_lines(tmp_path / "w.pdf") == [["NOMOR 93", "Salinan"]]


def test_browser_print_header_and_footer_are_not_content():
    for junk in ("4/3/24, 9:34 AM UNDANG", "4/3/24, 9:34 AM", "12/31/2024 10:05 PM Some title",
                 "https://jdih.kemenkeu.go.id/FullText/2003/19Tahun2003UU.HTM 24/26",
                 "https://jdih.kemenkeu.go.id/FullText/2003/19Tahun2003UU.HTM"):
        assert extract.NEVER_CONTENT_RE.match(junk), junk
    for text in ("Pasal 1", "pada tanggal 19 Juni 2003", "1/2 dari jumlah anggota",
                 "a. bahwa negara melalui https adalah"):
        assert not extract.NEVER_CONTENT_RE.match(text), text


def test_peraturan_go_id_banner_is_dropped():                       # old UU from peraturan.go.id
    assert _clean_page(["UNDANG-UNDANG", "Teks tidak dalam format asli. Kembali: tekan backspace", "isi"],
                       first_page=True) == ["UNDANG-UNDANG", "isi"]


@pytest.mark.parametrize("junk", ["Halaman 2 dari 10", "3 of 12", "www.djpp.depkumham.go.id",
                                  "ditjen Peraturan Perundang-undangan", "file:///C:/UU/2003/19.htm"])
def test_print_and_site_marks_are_dropped_anywhere_on_a_page(junk):
    assert _clean_page(["teks", junk, "isi"], first_page=False) == ["teks", "isi"]
