from hukum_bersih.akn.bluebell import escape, to_bluebell
from hukum_bersih.akn.build import to_akn
from hukum_bersih.pdf.extract import clean_lines
from hukum_bersih.pdf.structure import parse_lines

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


NS = {"a": "http://docs.oasis-open.org/legaldocml/ns/akn/3.0"}


def test_bluebell_text():
    text = to_bluebell(parse())
    assert "  CHAPTER II - RUANG LINGKUP\n" in text
    assert "    ART 2 -\n      PARA (1)\n        Aset dirampas berdasarkan Pasal 5" in text
    assert "        POINT a.\n          tulisan;" in text  # nested under POINT 2.
    assert "CONCLUSIONS\n" in text and "ATTACHMENT Penjelasan\n" in text


def test_escape():
    assert escape("dan/atau") == "dan/atau"
    assert escape("lihat https://contoh.go.id") == "lihat https:\\//contoh.go.id"
    assert escape("PART dari aset") == "\\PART dari aset"
    assert escape("a\\b") == "a\\\\b"


def test_akoma_ntoso():
    from lxml import etree

    xml = etree.fromstring(to_akn(to_bluebell(parse()), "/akn/id/bill/2026/contoh", "bill"))
    eids = [e.get("eId") for e in xml.iter() if e.get("eId")]
    assert "chp_I__art_1__point_2__point_a" in eids
    assert "chp_II__art_2__para_2__point_b" in eids
    assert len(xml.findall(".//a:body//a:article", NS)) == 2
    assert len(xml.findall(".//a:attachment//a:article", NS)) == 2
    assert xml.find(".//a:FRBRlanguage", NS).get("language") == "ind"


def test_list_nesting_resets_per_pasal():
    """Regression: letters in a Pasal following a Pasal with numbered definitions were nested
    one level too deep, and Bluebell then showed "POINT a." as text."""
    lines = ["Pasal 1", "Dalam Undang-Undang ini:", "1.", "Aset adalah benda.", "2.",
             "Dokumen adalah:", "a.", "tulisan;", "b.", "peta.",
             "Pasal 2", "Dilaksanakan berdasarkan asas:", "a.", "kepastian hukum", "b.",
             "keadilan;", "c.", "kemanfaatan."]
    doc = parse_lines(lines)
    pasal2 = doc.blocks[[b.label for b in doc.blocks].index("Pasal 2"):]
    assert [(b.label, b.level) for b in pasal2 if b.kind == "item"] == [
        ("a.", 1), ("b.", 1), ("c.", 1)]
    to_akn(to_bluebell(doc), "/akn/id/bill/2026/contoh", "bill")  # raises on leaked markup


def test_numbers_inside_letters_and_back():
    lines = ["Pasal 1", "Meliputi:", "a.", "satu:", "1.", "x;", "2.", "y;", "b.", "dua."]
    items = [(b.label, b.level) for b in parse_lines(lines).blocks if b.kind == "item"]
    assert items == [("a.", 1), ("1.", 2), ("2.", 2), ("b.", 1)]


def test_leaked_markup_is_rejected():
    import pytest

    from hukum_bersih.akn.build import LeakedMarkupError

    bad = "BODY\n  ART 1 -\n    Teks:\n\n      POINT a.\n        x\n"
    with pytest.raises(LeakedMarkupError):
        to_akn(bad, "/akn/id/bill/2026/contoh", "bill")
