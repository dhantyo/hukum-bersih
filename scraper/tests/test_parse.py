from hukum_bersih.parse import clean_lines, parse_lines, to_markdown

PAGES = [
    ["F", "PDIP", "PEMERINTAH", "RANCANGAN", "UNDANG-UNDANG REPUBLIK INDONESIA",
     "Menimbang : a.", "bahwa satu;", "b.", "bahwa dua;", "Mengingat", ": Pasal 20 UUD;",
     "MEMUTUSKAN:", "BAB I", "KETENTUAN UMUM", "Pasal 1", "Dalam Undang-", "Undang ini:",
     "1.", "Aset adalah benda.", "2.", "Dokumen adalah:", "a.", "tulisan;", "b.", "peta."],
    ["2", "BAB II", "RUANG", "LINGKUP", "Pasal 2", "(1) Aset dirampas berdasarkan",
     "Pasal 5 ayat (1) huruf a.", "(2) Selain ayat", "(1) tersebut, juga:", "a. benda;",
     "b. hak.", "Agar setiap orang mengetahuinya, memerintahkan.", "Disahkan di Jakarta",
     "PENJELASAN", "I. UMUM", "Ini umum.", "II. PASAL DEMI PASAL", "Pasal 1",
     "Cukup jelas.", "Pasal 2", "Ayat (1)", "Cukup jelas.", "TAMBAHAN LEMBARAN NEGARA"],
]


def parse():
    return parse_lines(clean_lines(PAGES))


def test_headers_and_page_numbers_removed():
    lines = clean_lines(PAGES)
    assert lines[0] == "RANCANGAN"
    assert "2" not in lines and "PDIP" not in lines


def test_structure():
    doc = parse()
    assert doc.pasal_count == 2 and doc.bab_count == 2
    kinds = [(b.kind, b.label) for b in doc.blocks]
    assert ("pasal", "Pasal 1") in kinds and ("p_pasal", "Pasal 2") in kinds
    bab2 = next(b for b in doc.blocks if b.label == "BAB II")
    assert bab2.text == "RUANG LINGKUP"


def test_cross_reference_is_not_a_heading():
    doc = parse()
    ayat = [b for b in doc.blocks if b.kind == "ayat"]
    assert [a.label for a in ayat] == ["(1)", "(2)"]
    assert ayat[0].text == "Aset dirampas berdasarkan Pasal 5 ayat (1) huruf a."
    assert ayat[1].text == "Selain ayat (1) tersebut, juga:"


def test_hyphen_join_and_nesting():
    doc = parse()
    pasal1_text = next(b for b in doc.blocks if b.kind == "text" and "Dalam" in b.text)
    assert pasal1_text.text == "Dalam Undang-Undang ini:"
    items = [(b.label, b.level) for b in doc.blocks if b.kind == "item"]
    assert ("1.", 1) in items and ("a.", 2) in items


def test_markdown():
    md = to_markdown(parse(), {"id": "ruu_contoh_2026-01-01_draft"})
    assert "#### Pasal 2 {#pasal-2}" in md
    assert "#### Pasal 2 {#penjelasan-pasal-2}" in md
    assert "\n  a. tulisan;\n" in md  # nested, but never a 4-space code block
    assert "Mengingat: Pasal 20 UUD;" in md
    assert "Agar setiap orang mengetahuinya, memerintahkan." in md
    assert "pasal_count: 2" in md
