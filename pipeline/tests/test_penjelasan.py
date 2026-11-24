"""Penjelasan, Lampiran and the copy certification after a law's closing."""

import pymupdf
import pytest

from hukum_bersih.pdf.structure import parse_lines, parse_pdf


def kinds(doc, kind):
    return [b for b in doc.blocks if b.kind == kind]


def pdf(path, lines):
    doc = pymupdf.open()
    page = doc.new_page()
    for i, ln in enumerate(lines):
        page.insert_text((72, 72 + 16 * i), ln, fontsize=10)
    doc.save(path)
    return path


def test_penjelasan_umum_on_one_line():                           # UU 25/1956
    doc = parse_lines(["Menimbang : a. bahwa x;", "Pasal 1", "isi.", "PENJELASAN UMUM", "Teks umum."])
    assert [b.kind for b in doc.blocks][-3:] == ["penjelasan", "umum", "text"]


def test_penjelasan_heading_with_a_full_stop():                     # UU 3/1949, UU 4/1956
    doc = parse_lines(["Menimbang : a. bahwa x;", "Pasal 1", "isi.", "MEMORI PENJELASAN.", "Teks."])
    assert any(b.kind == "penjelasan" for b in doc.blocks)


def test_penjelasan_with_lettered_sections():                       # UU 6/1967
    doc = parse_lines(["Menimbang : a. bahwa x;", "Pasal 1", "isi.", "PENJELASAN ATAS UNDANG-UNDANG No. 6 TAHUN 1967",
                       "A. PENJELASAN UMUM.", "Teks.", "B. PENJELASAN PASAL DEMI PASAL.", "Pasal 1", "Cukup jelas."])
    assert [b.kind for b in doc.blocks if b.kind in {"penjelasan", "umum", "pasal_demi_pasal", "p_pasal"}] == [
        "penjelasan", "umum", "pasal_demi_pasal", "p_pasal"]


def test_penjelasan_may_skip_pasal():
    from hukum_bersih.pdf.structure import parse_lines

    doc = parse_lines(["UNDANG-UNDANG", "NOMOR 2 TAHUN 1962", "TENTANG", "CONTOH"]
                      + [x for k in range(1, 14) for x in (f"Pasal {k}", f"Isi {k}.")]
                      + ["Disahkan di Jakarta", "pada tanggal 1 Januari 1962",
                         "PENJELASAN", "UMUM", "Umum.", "PASAL DEMI PASAL", "Pasal 1.", "Cukup jelas.",
                         "Pasal 5.", "Lihat juga", "Pasal 7.", "Pasal 12.", "Cukup jelas", "Pasal 13.", "Jelas."])
    assert [b.label for b in doc.blocks if b.kind == "p_pasal"] == ["Pasal 1", "Pasal 5", "Pasal 12", "Pasal 13"]


LAW = ["Menimbang : a. bahwa x;", "Pasal 1", "Satu.", "Pasal 2", "Dua.", "Pasal 3", "Tiga."]


def test_penjelasan_sections_with_the_numeral_on_its_own_line():
    doc = parse_lines(LAW + ["PENJELASAN", "I.", "UMUM", "Kalimat satu.", "Kalimat dua.", "II.", "PASAL DEMI PASAL",
                             "Pasal 1", "Cukup jelas."])
    start = [b.kind for b in doc.blocks].index("penjelasan")
    assert [(b.kind, b.text or b.label) for b in doc.blocks[start + 1:]] == [
        ("umum", "Umum"), ("text", "Kalimat satu."), ("text", "Kalimat dua."),   # one paragraph per sentence
        ("pasal_demi_pasal", "Pasal demi Pasal"), ("p_pasal", "Pasal 1"), ("text", "Cukup jelas.")]


def test_penjelasan_labels_for_ayat_huruf_and_angka():               # Lampiran II item 190
    doc = parse_lines(LAW + ["PENJELASAN", "II. PASAL DEMI PASAL", "Pasal 1", "Ayat (1)", "Cukup jelas.",
                             "Pasal 2", "Huruf a", "Cukup jelas.", "Angka 2 Yang dimaksud dengan “x” adalah y."])
    assert [(b.label, b.text) for b in kinds(doc, "p_label")] == [
        ("Ayat (1)", "Cukup jelas."), ("Huruf a", "Cukup jelas."), ("Angka 2", "Yang dimaksud dengan “x” adalah y.")]


def test_misprinted_pasal_in_the_penjelasan_is_kept_when_the_next_one_confirms_it():
    doc = parse_lines(LAW + ["PENJELASAN", "II. PASAL DEMI PASAL", "Pasal 1", "Cukup jelas.",
                             "Pasal 9", "Cukup jelas.", "Pasal 3", "Cukup jelas."])
    assert [b.label for b in kinds(doc, "p_pasal")] == ["Pasal 1", "Pasal 9", "Pasal 3"]


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


@pytest.mark.xfail(strict=True, reason="known gap: closing lines are taken out of a Lampiran")
def test_closing_formula_quoted_in_a_lampiran_stays_in_the_lampiran():
    # UU 12/2011 Lampiran II items 161-173 (52 lines lost), UU 17/2016's attached Perppu (5 lines)
    doc = parse_lines(LAW + ["Disahkan di Jakarta", "LAMPIRAN II", "161. Rumusan perintah pengundangan:", "Contoh:",
                             "Agar setiap orang mengetahuinya, memerintahkan pengundangan …", "Disahkan di Jakarta",
                             "pada tanggal …"])
    assert [b.text for b in kinds(doc, "closing")] == ["Disahkan di Jakarta"]


@pytest.mark.xfail(strict=True, reason="known gap: a quoted LAMPIRAN heading starts a new Lampiran")
def test_lampiran_heading_quoted_as_an_example_does_not_start_a_lampiran():
    # UU 12/2011 Lampiran II item 194 ("Contoh: LAMPIRAN I" / "LAMPIRAN II"): 4 Lampiran instead of 2
    doc = parse_lines(LAW + ["Disahkan di Jakarta", "LAMPIRAN I", "Naskah akademik.", "LAMPIRAN II",
                             "194. Tiap lampiran diberi nomor urut.", "Contoh: LAMPIRAN I", "LAMPIRAN II",
                             "195. Judul lampiran."])
    assert [b.label for b in kinds(doc, "lampiran")] == ["LAMPIRAN I", "LAMPIRAN II"]


def test_penjelasan_after_the_copy_certification_is_kept():          # UU 2/2025 lost it before
    lines = (["Menimbang : a. bahwa x;", "Pasal I", "1. Ketentuan Pasal 1 diubah sehingga berbunyi sebagai berikut:",
              "Pasal 1", "isi.", "Pasal II", "Berlaku.", "Disahkan di Jakarta", "PRABOWO SUBIANTO",
              "LEMBARAN NEGARA REPUBLIK INDONESIA TAHUN 2025 NOMOR 29",
              "Salinan sesuai dengan aslinya", "KEMENTERIAN SEKRETARIAT NEGARA", "Or MS dia Silyanna Djaman",
              "PENJELASAN", "ATAS", "UNDANG-UNDANG REPUBLIK INDONESIA", "1. UMUM", "Mineral dan Batubara adalah kekayaan.",
              "II. PASAL DEMI PASAL", "Pasal I", "Angka 1", "Pasal 1", "Cukup jelas.", "Pasal II", "Cukup jelas.",
              "TAMBAHAN LEMBARAN NEGARA REPUBLIK INDONESIA NOMOR 7100"])
    doc = parse_lines(lines)
    text = " ".join(b.text for b in doc.blocks)
    assert "Mineral dan Batubara adalah kekayaan." in text and "Silyanna" not in text
    assert [b.label for b in kinds(doc, "p_pasal")] == ["Pasal I", "Pasal II"]
    assert any(b.kind == "umum" for b in doc.blocks)


def test_a_runaway_copy_certification_skip_is_capped():
    lines = ["Menimbang : a. bahwa x;", "Pasal 1", "isi.", "Disahkan di Jakarta", "Salinan sesuai dengan aslinya"] + \
            [f"baris {k}" for k in range(40)]
    doc = parse_lines(lines)
    assert "baris 39" in " ".join(b.text for b in doc.blocks)
    assert any("no end found" in w for w in doc.warnings)
