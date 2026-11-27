"""Amending laws (Pasal I/II): the law's own pasal vs the amended law's quoted pasal."""

from hukum_rapih.pdf.structure import parse_lines


def kinds(doc, kind):
    return [b for b in doc.blocks if b.kind == kind]


def test_amending_law_is_recognised_from_its_first_pasal():
    from hukum_rapih.pdf.structure import Block, Document

    assert Document([Block("pasal", "Pasal I"), Block("pasal", "Pasal II")]).amending
    assert not Document([Block("pasal", "Pasal 1"), Block("pasal", "Pasal 2")]).amending
    assert not Document([]).amending


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


def test_own_pasal_2_after_amendments_in_pasal_i():                 # UU 2/1953, UU 12/1957
    doc = parse_lines(["Menimbang : a. bahwa x;", "Pasal I", "Ordonansi Pajak Rumah tangga 1908 diubah sebagai berikut:",
                       "XXVI.Pasal 44 akan berbunyi sebagai berikut:", "Pasal 44", "(1) Di mana dalam ordonansi ini.",
                       "XXVII. Pasal 46 dihapuskan.", "Pasal 2", "(1) Pemungutan pajak tidak dilakukan.",
                       "Pasal 3", "Undang-undang ini mulai berlaku pada tanggal 1 Januari 1953."])
    assert [b.label for b in kinds(doc, "pasal")] == ["Pasal I", "Pasal 2", "Pasal 3"]
    # an amending law that quotes Pasal 1 and Pasal 2 in one instruction keeps both quoted
    doc = parse_lines(["Menimbang : a. bahwa x;", "Pasal I", "1. Ketentuan Pasal 1 dan Pasal 2 diubah sehingga berbunyi sebagai berikut:",
                       "Pasal 1", "Satu.", "Pasal 2", "Dua.", "Pasal II", "Berlaku."])
    assert [b.label for b in kinds(doc, "pasal")] == ["Pasal I", "Pasal II"]


def test_quoted_pasal_of_an_amended_law_is_not_taken_as_a_skipped_number():
    """UU 7/2021 amends laws with Arabic pasal. The quoted heading after "... berbunyi sebagai
    berikut:" ("Pasal 4", "Pasal 5" of the amended law) continued the sequence after the law's own
    Pasal 2 (the skip tolerance of ``misprinted``) and the real Pasal 3 to 5 were lost."""
    from hukum_rapih.pdf.structure import parse_lines

    head = ["UNDANG-UNDANG", "NOMOR 7 TAHUN 2021", "TENTANG", "CONTOH"]
    doc = parse_lines(head + [
        "Pasal 1", "Satu.", "Pasal 2",
        "Beberapa ketentuan dalam Undang-Undang Nomor 6 Tahun 1983 diubah sebagai berikut:",
        "1. Ketentuan ayat (1) Pasal 4 diubah sehingga berbunyi sebagai berikut:", "Pasal 4", "(1) Kutipan empat.",
        "2. Ketentuan ayat (1) Pasal 5 diubah sehingga berbunyi sebagai berikut:", "Pasal 5", "(1) Kutipan lima.",
        "Pasal 3", "Tiga.", "Pasal 4", "Empat.", "Pasal 5", "Lima."])
    assert [b.label for b in doc.blocks if b.kind == "pasal"] == [f"Pasal {k}" for k in range(1, 6)]
    assert not any("belongs" in w for w in doc.warnings)


def test_amending_penjelasan_puts_angka_above_ayat():
    from hukum_rapih.akn.bluebell import to_bluebell
    from hukum_rapih.akn.build import to_akn
    from hukum_rapih.pdf.structure import Block, Document

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
