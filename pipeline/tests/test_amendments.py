from hukum_rapih.amendments import changes, flatten, instructions, lines

AMENDING = """PREFACE
  UNDANG-UNDANG NOMOR 3 TAHUN 2020

BODY
  ART I -
    Beberapa ketentuan dalam Undang-Undang Nomor 4 Tahun 2009 diubah sebagai berikut:

    POINT 1.
      Ketentuan Pasal 4 diubah sehingga berbunyi sebagai berikut: Pasal 4

    PARA (1)
      Mineral dikuasai oleh negara.

    PARA (2)
      Penguasaan sebagaimana dimaksud dalam Pasal 4 ayat (1) diselenggarakan oleh:

    POINT a.
      Pemerintah Pusat; dan

    POINT b.
      Pemerintah Daerah. -12- 2. Pasal 7 dihapus.

    POINT 3.
      Di antara Pasal 27 dan Pasal 28 disisipkan 2 (dua) pasal, yakni Pasal 27A dan Pasal 278 sehingga berbunyi sebagai berikut: Pasal 27A Setiap orang wajib. Pasal 27B Ketentuan mengenai izin diatur dengan Peraturan Pemerintah.

    POINT 4.
      Ketentuan Pasal 5 tetap dengan perubahan penjelasan ayat (1) sehingga penjelasan Pasal 5 menjadi sebagaimana ditetapkan dalam penjelasan.

  ART II -
    Undang-Undang ini mulai berlaku pada tanggal diundangkan.

CONCLUSIONS
  Disahkan di Jakarta
"""


def test_instructions():
    found = instructions(flatten(AMENDING))
    assert [i.n for i in found] == [1, 2, 3, 4]
    p4 = found[0].pasal[0]
    assert (p4.num, p4.kind) == ("4", "diubah")
    assert p4.text.startswith("(1) Mineral dikuasai") and "-12-" not in p4.text
    assert [(ln.num, ln.indent) for ln in p4.lines] == [("(1)", 0), ("(2)", 0), ("a.", 1), ("b.", 1)]
    assert [(p.num, p.kind) for p in found[1].pasal] == [("7", "dihapus")]
    assert [(p.num, p.kind, p.text[:12]) for p in found[2].pasal] == [
        ("27A", "disisipkan", "Setiap orang"), ("27B", "disisipkan", "Ketentuan me")]
    assert found[3].pasal == []          # only the Penjelasan changed


def test_changes():
    assert changes(flatten(AMENDING)) == {
        "diubah": ["4"], "disisipkan": ["27A", "27B"], "dihapus": ["7"]}


def test_definitions_are_numbered_lines():
    out = lines("Dalam Undang-Undang ini yang dimaksud dengan: 1. Mineral adalah senyawa. 2. Batubara "
                "adalah endapan. 3. Pertambangan adalah kegiatan.")
    assert [ln.num for ln in out] == [None, "1.", "2.", "3."]


def test_ocr_ayat_numbers_and_nested_definitions():
    out = lines("(1) Untuk kepentingan nasional. (21 Untuk melaksanakan. (3) Ketentuan ayat (l) diatur.")
    assert [(ln.num, ln.text[:12]) for ln in out] == [
        ("(1)", "Untuk kepent"), ("(2)", "Untuk melaks"), ("(3)", "Ketentuan ay")]
    assert out[2].text == "Ketentuan ayat (l) diatur."      # text itself is kept as read
    out = lines("Dalam Undang-Undang ini yang dimaksud dengan: 1. BUMN adalah badan usaha: "
                "a. seluruh modal; atau b. hak istimewa. 2. Anak Usaha adalah anak. 3. Persero.")
    assert [(ln.num, ln.indent) for ln in out] == [
        (None, 0), ("1.", 0), ("a.", 1), ("b.", 1), ("2.", 0), ("3.", 0)]
