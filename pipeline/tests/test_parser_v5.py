"""Parser v5 rules, each with lines as printed in the sample PDFs (docs/parser-review-2026-11.md)."""

from hukum_bersih.pdf.extract import _clean_page, rows
from hukum_bersih.pdf.structure import parse_lines


def kinds(doc, kind):
    return [b for b in doc.blocks if b.kind == kind]


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


def test_headings_with_a_full_stop_and_old_numbering():          # UU 25/1956, UU 6/1964
    doc = parse_lines(["UNDANG-UNDANG NOMOR 25 TAHUN 1956", "Menimbang : a. bahwa x;",
                       "BAB I.", "Ketentuan Umum.", "Pasal 1.", "Isi satu.",
                       "BAGIAN II.", "Pasal 2.", "Isi dua.",
                       "BAB II.", "Tentang Urusan Rumah-Tangga", "dan Kewajiban-Kewajiban Propinsi.",
                       "Pasal 3.", "Isi tiga."])
    assert [b.label for b in kinds(doc, "pasal")] == ["Pasal 1", "Pasal 2", "Pasal 3"]
    assert [b.text for b in kinds(doc, "bab")] == [
        "Ketentuan Umum.", "Tentang Urusan Rumah-Tangga dan Kewajiban-Kewajiban Propinsi."]


def test_bab_printed_twice_is_kept_as_printed():                   # UU 19/1997: BAB VII twice
    # same shape: BAB I, II, II (a misprint for III), IV
    doc = parse_lines(["Menimbang : a. bahwa x;", "BAB I", "SATU", "Pasal 1", "x", "BAB II", "DUA",
                       "Pasal 2", "y", "BAB II", "TIGA", "Pasal 3", "z", "BAB IV", "EMPAT", "Pasal 4", "w"])
    assert [(b.label, b.text) for b in kinds(doc, "bab")] == [
        ("BAB I", "SATU"), ("BAB II", "DUA"), ("BAB II", "TIGA"), ("BAB IV", "EMPAT")]


def test_pasal_number_on_its_own_line():                          # scans: "Pasal" / "4"
    doc = parse_lines(["Menimbang : a. bahwa x;", "Pasal", "1", "satu", "Pasal", "2", "dua"])
    assert [b.label for b in kinds(doc, "pasal")] == ["Pasal 1", "Pasal 2"]


def test_preamble_lists_on_the_label_line_and_after_a_colon():    # UU 14/2013, UU 6/1964
    doc = parse_lines(["UNDANG-UNDANG", "Menimbang : a. bahwa satu;", "b. bahwa dua;",
                       "Mengingat", ": 1. Pasal-pasal 5, 20 dan 33 ayat 2 Undang-undang Dasar;",
                       "2. Undang-undang No. 10 Prp tahun 1960.",
                       "Dengan persetujuan Dewan Perwakilan Rakyat Gotong Royong;",
                       "MEMUTUSKAN :", "Menetapkan : UNDANG-UNDANG TENTANG X.", "Pasal 1", "isi"])
    items = [(b.label, b.text[:20]) for b in kinds(doc, "item")]
    assert items == [("a.", "bahwa satu;"), ("b.", "bahwa dua;"),
                     ("1.", "Pasal-pasal 5, 20 da"), ("2.", "Undang-undang No. 10")]
    labels = [b.label for b in kinds(doc, "preamble")]
    assert "Dengan persetujuan" in labels


def test_crest_caption_is_not_the_title():
    doc = parse_lines(["PRESIDEN", "REPUBLIK INDONESIA", "UNDANG-UNDANG REPUBLIK INDONESIA",
                       "NOMOR 6 TAHUN 1964", "Menimbang : a. bahwa x;", "Pasal 1", "isi"])
    assert kinds(doc, "title")[0].text == "UNDANG-UNDANG REPUBLIK INDONESIA NOMOR 6 TAHUN 1964"


def test_closing_kept_line_by_line():                             # UU 4/2009
    doc = parse_lines(["Menimbang : a. bahwa x;", "Pasal 1",
                       "Undang-Undang ini mulai berlaku pada tanggal diundangkan.",
                       "Agar setiap orang mengetahuinya, memerintahkan pengundangan",
                       "Undang-Undang ini dengan penempatannya dalam Lembaran Negara Republik Indonesia.",
                       "Disahkan di Jakarta", "pada tanggal 12 Januari 2009", "PRESIDEN REPUBLIK INDONESIA,",
                       "ttd.", "DR. H. SUSILO BAMBANG YUDHOYONO",
                       "LEMBARAN NEGARA REPUBLIK INDONESIA TAHUN 2009 NOMOR 4"])
    assert kinds(doc, "pasal")[-1].label == "Pasal 1"
    assert "Agar" not in " ".join(b.text for b in doc.blocks if b.kind not in {"closing"})
    closing = [b.text for b in kinds(doc, "closing")]
    assert closing[0].startswith("Agar setiap orang") and closing[0].endswith("Indonesia.")
    assert closing[1:5] == ["Disahkan di Jakarta", "pada tanggal 12 Januari 2009",
                            "PRESIDEN REPUBLIK INDONESIA,", "ttd."]


def test_old_closing_formula():                                   # UU 25/1956
    doc = parse_lines(["Menimbang : a. bahwa x;", "Pasal 1", "isi.",
                       "Agar supaya setiap orang dapat mengetahuinya, memerintahkan", "pengundangan.",
                       "Disahkan di Jakarta"])
    assert [b.text for b in kinds(doc, "closing")][:2] == [
        "Agar supaya setiap orang dapat mengetahuinya, memerintahkan pengundangan.", "Disahkan di Jakarta"]


def test_penjelasan_umum_on_one_line():                           # UU 25/1956
    doc = parse_lines(["Menimbang : a. bahwa x;", "Pasal 1", "isi.", "PENJELASAN UMUM", "Teks umum."])
    assert [b.kind for b in doc.blocks][-3:] == ["penjelasan", "umum", "text"]
