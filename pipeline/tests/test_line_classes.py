"""What a single line is, from its text alone (pdf/lines.py, rules L1-L24 of
docs/parser-rules.md). Lines are printed lines of the law the inventory names. The heading
repairs (L1-L5, ``normalise``) are tested in test_headings.py."""

import re
from pathlib import Path

import pytest

from hukum_bersih.pdf.lines import JOIN_PASAL, REPAIRS, RULES, Kind, classify

CASES = [
    # (law, line, class, fields)
    ("UU 4/2009", "BAB IV", Kind.BAB, ("IV",)),
    ("UU 2/1957", "Bab Pertama", Kind.BAB, ("Pertama",)),
    ("UU 12/2022", "Bagian Kesatu", Kind.BAGIAN, ("Kesatu",)),
    ("UU 25/1956", "BAGIAN II", Kind.BAGIAN, ("II",)),
    ("UU 4/2009", "Paragraf 1", Kind.PARAGRAF, ("1",)),
    ("UU 4/2009", "Pasal 1", Kind.PASAL, ("1",)),
    ("UU 14/2013", "Pasal I", Kind.PASAL, ("I",)),
    ("Lampiran II item 234", "Pasal 128A", Kind.PASAL, ("128A",)),
    ("UU 4/2009", "(1) Mineral dan batubara sebagai sumber daya alam yang tak", Kind.AYAT,
     ("1", "Mineral dan batubara sebagai sumber daya alam yang tak")),
    ("UU 4/2009", "b. bahwa kegiatan usaha pertambangan mineral dan", Kind.LIST_ITEM,
     ("letter", "b", "bahwa kegiatan usaha pertambangan mineral dan")),
    ("UU 4/2009", "1. Pertambangan adalah sebagian atau seluruh tahapan", Kind.LIST_ITEM,
     ("number", "1", "Pertambangan adalah sebagian atau seluruh tahapan")),
    ("UU 14/2013", "Menimbang : a. bahwa untuk melaksanakan Putusan", Kind.PREAMBLE,
     ("Menimbang", "a. bahwa untuk melaksanakan Putusan")),
    ("UU 25/1956", "Dengan persetujuan Dewan Perwakilan Rakyat:", Kind.PREAMBLE,
     ("Dengan persetujuan", "Dewan Perwakilan Rakyat:")),
    ("UU 4/2009", "MEMUTUSKAN:", Kind.PREAMBLE, ("MEMUTUSKAN", "")),
    ("UU 14/2013", "DENGAN RAHMAT TUHAN YANG MAHA ESA", Kind.OPENING, ()),
    ("UU 14/2013", "PRESIDEN REPUBLIK INDONESIA,", Kind.OPENING, ()),
    ("UU 6/1964", "PRESIDEN", Kind.CREST_CAPTION, ()),
    ("UU 6/1964", "REPUBLIK INDONESIA", Kind.CREST_CAPTION, ()),
    ("UU 14/2013", "PENJELASAN", Kind.PENJELASAN, ()),
    ("UU 25/1956", "MEMORI PENJELASAN", Kind.PENJELASAN, ()),
    ("UU 6/1967", "PENJELASAN ATAS UNDANG-UNDANG No. 6 TAHUN 1967", Kind.PENJELASAN, ()),
    ("UU 1/1945", "PENDJELASAN UNDANG-UNDANG 1945 NO. 1", Kind.PENJELASAN, ()),
    ("UU 6/1964", "PENJELASAN UMUM.", Kind.PENJELASAN_UMUM, ("PENJELASAN",)),
    ("UU 14/2013", "I. UMUM", Kind.PENJELASAN_PART, ("umum",)),
    ("UU 25/1956", "A. PENJELASAN UMUM", Kind.PENJELASAN_PART, ("umum",)),
    ("UU 2/2025", "1. UMUM", Kind.PENJELASAN_PART, ("umum",)),
    ("UU 12/2022", "II. PASAL DEMI PASAL", Kind.PENJELASAN_PART, ("pasal_demi_pasal",)),
    ("UU 25/1956", "B. PENJELASAN PASAL DEMI PASAL", Kind.PENJELASAN_PART, ("pasal_demi_pasal",)),
    ("Penjelasan layout", "II.", Kind.PENJELASAN_PART, ("",)),
    ("UU 14/2013", "Ayat (1)", Kind.PENJELASAN_LABEL, ("Ayat (1)", "")),
    ("UU 12/2022", "Huruf a", Kind.PENJELASAN_LABEL, ("Huruf a", "")),
    ("UU 14/2013", "Angka 1", Kind.PENJELASAN_LABEL, ("Angka 1", "")),
    ("UU 12/2022", "Agar setiap orang mengetahuinya, memerintahkan", Kind.CLOSING, ()),
    ("UU 25/1956", "Agar supaya setiap orang dapat mengetahuinya, memerintahkan", Kind.CLOSING, ()),
    ("UU 12/2022", "Disahkan di Jakarta", Kind.CLOSING, ()),
    ("UU 12/2022", "Diundangkan di Jakarta", Kind.CLOSING, ()),
    ("UU 1/1945", "Djakarta, tanggal 23 Nopember 1945,", Kind.CLOSING, ()),
    ("UU 25/1956", "TAMBAHAN LEMBARAN NEGARA NOMOR 1106", Kind.CLOSING, ()),
    ("UU 16/1947", "Diumumkan pada tanggal 5 Juni 1947.", Kind.CLOSING, ()),
    ("old spelling", "Dikeluarkan di Jakarta", Kind.CLOSING, ()),
    ("OCR", "Disahkah di Jakarta", Kind.CLOSING, ()),
    ("old spelling", "Disjahkan di Djakarta", Kind.CLOSING, ()),
    ("UU 14/2013", "LAMPIRAN", Kind.LAMPIRAN, ()),
    ("UU 14/2013", "LAMPIRAN I", Kind.LAMPIRAN, ()),
    ("UU 14/2013", "Salinan sesuai dengan aslinya", Kind.SALINAN, ()),
]


@pytest.mark.parametrize(("law", "line", "kind", "fields"), CASES)
def test_a_line_is_of_its_class_with_its_fields(law, line, kind, fields):
    assert classify(line).get(kind) == fields, law


@pytest.mark.parametrize(("line", "kind"), [
    ("Pasal 5 ayat (1) huruf a", Kind.PASAL),            # a reference starting a wrapped line
    ("Pasal 5,", Kind.PASAL),
    ("BAB IVA KETENTUAN", Kind.BAB),
    ("c) huruf kecil", Kind.LIST_ITEM),                    # G3: not a list level yet
    ("Dalam Undang-Undang ini yang dimaksud dengan:", Kind.PREAMBLE),
    ("PRESIDEN", Kind.OPENING),                            # the crest caption
    ("Penjelasan pasal ini", Kind.PENJELASAN),
    ("Disahkan oleh", Kind.CLOSING),
    ("LAMPIRAN UNDANG-UNDANG", Kind.LAMPIRAN),
])
def test_a_line_that_only_looks_like_a_class_is_not_of_it(line, kind):
    assert kind not in classify(line)


def test_a_line_can_be_of_several_classes():               # UU 25/1956: Penjelasan and Umum
    line = classify("PENJELASAN UMUM")
    assert {Kind.PENJELASAN, Kind.PENJELASAN_UMUM, Kind.PENJELASAN_PART} <= line.kinds.keys()


def test_plain_text_is_of_no_class():
    assert not classify("Mineral dan batubara sebagai sumber daya alam yang tak").kinds


def test_every_line_class_has_a_case():
    assert {kind for _, _, kind, _ in CASES} == set(Kind)


def test_every_rule_of_the_inventory_is_in_the_registry_once():
    ids = [i for entry in (JOIN_PASAL, *REPAIRS, *RULES) for i in entry.ids]
    assert sorted(ids, key=lambda i: int(i[1:])) == [f"L{n}" for n in range(1, 25)]


def test_every_registry_entry_names_a_test_that_exists():
    tests = Path(__file__).parent
    for entry in (JOIN_PASAL, *REPAIRS, *RULES):
        module, _, functions = entry.test.partition("::")
        source = (tests / f"{module}.py").read_text(encoding="utf-8")
        for name in functions.split(", "):
            assert re.search(rf"^def {name}\(", source, re.MULTILINE), f"{entry.ids}: {module}::{name}"
