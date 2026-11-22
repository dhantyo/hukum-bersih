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


def test_page_turn_words_in_the_middle_of_a_pdf_page():           # UU 19/2001, UU 12/1964
    from hukum_bersih.pdf.extract import clean_lines

    lines = clean_lines([["teks a", "Pasal 15…", "Pasal 15", "(1) Setelah", "teks b", "Ayat (4) …", "Ayat (4)",
                          "Cukup jelas", "x"], ["teks", "Pasal 7…."]])
    assert lines == ["teks a", "Pasal 15", "(1) Setelah", "teks b", "Ayat (4)", "Cukup jelas", "x", "teks"]
    # an ellipsis that announces nothing stays (it may be text)
    assert clean_lines([["dan seterusnya …", "Pasal 2", "x"]]) == ["dan seterusnya …", "Pasal 2", "x"]


def test_amending_law_keeps_quoted_pasal_inside_pasal_i():          # UU 18/2025, UU 14/2013
    doc = parse_lines(["Menimbang : a. bahwa x;", "Pasal I",
                       "Beberapa ketentuan dalam Undang-Undang Nomor 10 Tahun 2009 diubah sebagai berikut:",
                       "1. Ketentuan Pasal 1 diubah sehingga berbunyi sebagai berikut:",
                       "Pasal 1", "Dalam Undang-Undang ini yang dimaksud dengan:",
                       "2. Di antara BAB IV dan BAB V disisipkan 1 (satu) bab, yakni BAB IVA sehingga berbunyi:",
                       "BAB IVA", "PARIWISATA BERKELANJUTAN", "Pasal 2", "isi",
                       "Pasal II", "Undang-Undang ini mulai berlaku pada tanggal diundangkan."])
    assert [b.label for b in kinds(doc, "pasal")] == ["Pasal I", "Pasal II"]
    assert kinds(doc, "bab") == []
    body = " ".join(b.text for b in doc.blocks)
    assert "BAB IVA PARIWISATA BERKELANJUTAN Pasal 2 isi" in body


def test_ocr_reads_pasal_i_as_pasal_1():                              # UU 18/2025 (scan)
    doc = parse_lines(["UNDANG-UNDANG NOMOR 18 TAHUN 2025 TENTANG PERUBAHAN KETIGA ATAS UNDANG-UNDANG",
                       "Menimbang : a. bahwa x;", "Pasal 1",
                       "Beberapa ketentuan dalam Undang-Undang Nomor 10 Tahun 2009 diubah sebagai berikut:",
                       "1. Ketentuan Pasal 1 diubah sehingga berbunyi sebagai berikut:", "Pasal 1", "isi",
                       "Pasal II", "Undang-Undang ini mulai berlaku."])
    assert [b.label for b in kinds(doc, "pasal")] == ["Pasal I", "Pasal II"]
    assert any("Pasal I" in w for w in doc.warnings)


def test_crest_fragments_above_the_header_only():                  # UU 18/2025 (scan)
    assert _clean_page(["Pas", "4", "£", "(53", "PRESIDEN", "REPUBLIK INDONESIA", "-3-", "PasalI", "x."],
                       first_page=False) == ["PasalI", "x."]
    assert _clean_page(["1.", "Propinsi Kalimantan-Barat, yang", "teks"], first_page=False) == [
        "1.", "Propinsi Kalimantan-Barat, yang", "teks"]


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


def test_lampiran_after_the_penjelasan():                         # UU 14/2013
    from hukum_bersih.akn.bluebell import to_bluebell
    from hukum_bersih.akn.build import to_akn

    doc = parse_lines(["Menimbang : a. bahwa x;", "Pasal 1", "isi.", "Disahkan di Jakarta",
                       "PENJELASAN", "I. UMUM", "Teks.", "II. PASAL DEMI PASAL", "Pasal 1", "Cukup jelas.",
                       "TAMBAHAN LEMBARAN NEGARA REPUBLIK INDONESIA NOMOR 5416",
                       "LAMPIRAN", "UNDANG-UNDANG REPUBLIK INDONESIA", "NOMOR 14 TAHUN 2013",
                       "PRESIDEN REPUBLIK INDONESIA,", "ttd.", "DR. H. SUSILO BAMBANG YUDHOYONO",
                       "Salinan sesuai dengan aslinya", "KEMENTERIAN SEKRETARIAT NEGARA RI", "Wisnu Setiawan"])
    assert [b.label for b in kinds(doc, "lampiran")] == ["LAMPIRAN"]
    assert [b.text for b in kinds(doc, "lampiran_text")][:2] == ["UNDANG-UNDANG REPUBLIK INDONESIA", "NOMOR 14 TAHUN 2013"]
    assert "Wisnu Setiawan" not in " ".join(b.text for b in doc.blocks)      # copy certification left out
    text = to_bluebell(doc)
    assert "ATTACHMENT Lampiran" in text and text.index("ATTACHMENT Penjelasan") < text.index("ATTACHMENT Lampiran")
    to_akn(text, "/akn/id/act/uu/2013/14", "act")                         # valid Akoma Ntoso


def test_misprinted_pasal_i_in_an_ordinary_law():                  # UU 16/1953
    doc = parse_lines(["Menimbang : a. bahwa x;", "Pasal I.", "Peraturan ini berlaku.", "Pasal 2", "dua", "Pasal 3", "tiga"])
    assert [b.label for b in kinds(doc, "pasal")] == ["Pasal I", "Pasal 2", "Pasal 3"]


def test_form_dot_leaders_are_not_page_turn_words():               # UU 12/1953
    form = ["teks", "Hari lahir:.............Tempat kelahiran:.....", "Di............................"]
    assert _clean_page(form, first_page=False) == form
    assert _clean_page(["teks", "Pasal 7…."], first_page=False) == ["teks"]


def test_penjelasan_heading_with_a_full_stop():                     # UU 3/1949, UU 4/1956
    doc = parse_lines(["Menimbang : a. bahwa x;", "Pasal 1", "isi.", "MEMORI PENJELASAN.", "Teks."])
    assert any(b.kind == "penjelasan" for b in doc.blocks)


def test_page_numbers_and_serials_on_a_text_line():               # UU 20/2023, UU 6/2021, UU 36/2014
    assert _clean_page(["teks", "PPPK. | -7-", "Nomor 6516), SK No 095251 A '", "- 33 - ' (2) Proses evaluasi"],
                       first_page=False) == ["teks", "PPPK.", "Nomor 6516),", "(2) Proses evaluasi"]
    assert _clean_page(["teks", "Rp 1.000.000,- (satu juta rupiah)."], first_page=False)[1] == \
        "Rp 1.000.000,- (satu juta rupiah)."


def test_page_turn_word_just_after_its_heading():                  # UU 1/2009
    from hukum_bersih.pdf.extract import clean_lines

    assert clean_lines([["BAB VI", "RANCANG BANGUN", "BAB VI...", "Bagian Kesatu"]]) == [
        "BAB VI", "RANCANG BANGUN", "Bagian Kesatu"]


def test_penjelasan_with_lettered_sections():                       # UU 6/1967
    doc = parse_lines(["Menimbang : a. bahwa x;", "Pasal 1", "isi.", "PENJELASAN ATAS UNDANG-UNDANG No. 6 TAHUN 1967",
                       "A. PENJELASAN UMUM.", "Teks.", "B. PENJELASAN PASAL DEMI PASAL.", "Pasal 1", "Cukup jelas."])
    assert [b.kind for b in doc.blocks if b.kind in {"penjelasan", "umum", "pasal_demi_pasal", "p_pasal"}] == [
        "penjelasan", "umum", "pasal_demi_pasal", "p_pasal"]


def test_page_turn_on_the_same_line_as_text():                     # UU 1/2009
    from hukum_bersih.pdf.extract import clean_lines

    assert clean_lines([["BAB VI", "RANCANG BANGUN DAN PRODUKSI PESAWAT UDARA BAB VI . . .", "Bagian Kesatu"]]) == [
        "BAB VI", "RANCANG BANGUN DAN PRODUKSI PESAWAT UDARA", "Bagian Kesatu"]
    assert clean_lines([["sanksi administratif berupa: (2) Setiap...", "(2) Setiap orang"]]) == [
        "sanksi administratif berupa:", "(2) Setiap orang"]
    assert clean_lines([["x", "dan seterusnya ...", "lain", "y", "z"]]) == ["x", "dan seterusnya ...", "lain", "y", "z"]
