"""Title, preamble, BAB and Pasal headings as printed, including old numbering and OCR misreads."""

from hukum_bersih.pdf.structure import parse_lines


def kinds(doc, kind):
    return [b for b in doc.blocks if b.kind == kind]


def test_crest_caption_is_not_the_title():
    doc = parse_lines(["PRESIDEN", "REPUBLIK INDONESIA", "UNDANG-UNDANG REPUBLIK INDONESIA",
                       "NOMOR 6 TAHUN 1964", "Menimbang : a. bahwa x;", "Pasal 1", "isi"])
    assert kinds(doc, "title")[0].text == "UNDANG-UNDANG REPUBLIK INDONESIA NOMOR 6 TAHUN 1964"


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


def test_misprinted_pasal_i_in_an_ordinary_law():                  # UU 16/1953
    doc = parse_lines(["Menimbang : a. bahwa x;", "Pasal I.", "Peraturan ini berlaku.", "Pasal 2", "dua", "Pasal 3", "tiga"])
    assert [b.label for b in kinds(doc, "pasal")] == ["Pasal I", "Pasal 2", "Pasal 3"]


def test_misprinted_heading_numbers_confirmed_by_the_next_heading():
    from hukum_bersih.pdf.structure import parse_lines

    head = ["UNDANG-UNDANG", "NOMOR 19 TAHUN 1948", "TENTANG", "CONTOH"]
    doc = parse_lines(head + ["Pasal 1", "Satu.", "Pasal 2", "Dua.", "Pasal 2", "Tiga.", "Pasal 4", "Empat.",
                              "Pasal II", "Lima.", "Pasal 6", "sebagaimana dimaksud dalam", "Pasal 9",
                              "ayat (1).", "Pasal 7", "Tujuh."])
    labels = [b.label for b in doc.blocks if b.kind == "pasal"]
    assert labels == ["Pasal 1", "Pasal 2", "Pasal 2", "Pasal 4", "Pasal II", "Pasal 6", "Pasal 7"]
    assert any("printed where Pasal 3 belongs" in w for w in doc.warnings)


def test_ocr_speck_before_a_pasal_heading():
    from hukum_bersih.pdf.structure import normalise

    assert normalise(["' Pasal 8", "‘Pasal 9", ". Pasal 10."]) == ["Pasal 8", "Pasal 9", "Pasal 10"]
    assert normalise(["Pasal 4 :", "Pasal 6'", "Pasal IV :"]) == ["Pasal 4", "Pasal 6", "Pasal IV"]
    assert normalise(["— Pasal 7", "- Pasal 7", "• Pasal 7"]) == ["Pasal 7"] * 3
    assert normalise(["(Pasal 7)"]) == ["(Pasal 7)"]
    assert normalise(["Pasal 5,", "Pasal 5;"]) == ["Pasal 5,", "Pasal 5;"]       # references
    assert normalise(["'Pasal 8 menyatakan bahwa"]) == ["'Pasal 8 menyatakan bahwa"]


def test_ocr_letters_for_digits_and_spaced_marks_in_headings():
    from hukum_bersih.pdf.structure import normalise

    assert normalise(["Pasal S1", "Pasal 1lA", "Pasal 1O", "Pasal 84 ,", "Pasal 9 ;"]) == [
        "Pasal 51", "Pasal 11A", "Pasal 10", "Pasal 84", "Pasal 9"]
    assert normalise(["Pasal II", "Pasal 5B", "Pasal 84,"]) == ["Pasal II", "Pasal 5B", "Pasal 84,"]
