"""The structure state machine cell by cell: a state, its counters and lines printed in the law
the rule names go in; the blocks, warnings and the state after come out. The ids are the
rules of docs/parser-rules.md; the last tests check that each id sits in the cells the
inventory says."""

import re
from pathlib import Path

import pytest

from hukum_rapih.pdf import structure
from hukum_rapih.pdf.lines import classify, normalise
from hukum_rapih.pdf.structure import TABLE, Block, Context, State, View, step

RULES = Path(__file__).parents[2] / "docs" / "parser-rules.md"
S = State


def read(state: State, lines: list[str], blocks=(), part: State | None = None, **counters):
    """Read ``lines`` from ``state``; the blocks written, the warnings and the state after."""
    ctx = Context(state=state, part=part or state, **counters)
    ctx.doc.blocks.extend(Block(*b) for b in blocks)
    classified, i = [classify(text) for text in normalise(lines)], 0
    while i < len(classified):
        i += step(ctx, View(classified, i))
    new = [(b.kind, b.label, b.text) for b in ctx.doc.blocks[len(blocks):]]
    return new, ctx.doc.warnings, ctx.state


PASAL_I = [("pasal", "Pasal I")]
CLOSED = [("pasal", "Pasal 9"), ("closing", "", "Disahkan di Jakarta")]
EXPLAINED = [("pasal", "Pasal 2"), ("penjelasan", "", "PENJELASAN"), ("closing", "", "Disahkan di Jakarta")]
# a law enacting a Perppu prints the Perppu whole, its Penjelasan too, as its Lampiran; BPK may
# give the law's own Penjelasan as a separate PDF, read after it
ENACTING_PERPPU = [("title", "", "UNDANG-UNDANG REPUBLIK INDONESIA NOMOR 9 TAHUN 2017 TENTANG PENETAPAN"),
                   ("pasal", "Pasal 2"), ("lampiran", "LAMPIRAN")]


@pytest.mark.parametrize(("rule", "law", "state", "setup", "lines", "blocks", "warned", "after"), [
    ("S1", "UU 4/2009", S.BODY, {"last_pasal": 4, "blocks": [("pasal", "Pasal 4"), ("text", "", "sebagaimana")]},
     ["dimaksud dalam", "Pasal 7", "ayat (1)."], [], [], S.BODY),
    ("S1", "UU 4/2009", S.BODY, {"last_pasal": 4}, ["Pasal 5", "Isi."],
     [("pasal", "Pasal 5", ""), ("text", "", "Isi.")], [], S.BODY),
    ("S2", "Lampiran II item 234", S.BODY, {"last_pasal": 2}, ["Pasal 2A"], [("pasal", "Pasal 2A", "")], [], S.BODY),
    ("S3", "UU 19/1948", S.BODY, {"last_pasal": 9, "blocks": [("pasal", "Pasal 9")]},
     ["Isi.", "Pasal 9", "Isi.", "Pasal 11"],
     [("text", "", "Isi."), ("pasal", "Pasal 9", ""), ("text", "", "Isi."), ("pasal", "Pasal 11", "")],
     ["'Pasal 9' printed where Pasal 10 belongs; kept as printed"], S.BODY),
    ("S4", "UU 7/2021", S.BODY, {"last_pasal": 4, "blocks": [("pasal", "Pasal 4")]},
     ["sehingga berbunyi sebagai berikut:", "Pasal 7", "Isi.", "Pasal 8"],
     [("text", "", "sehingga berbunyi sebagai berikut: Pasal 7 Isi. Pasal 8")], [], S.BODY),
    ("S5", "UU 19/1997", S.BODY, {"last_pasal": 8, "last_bab": 3}, ["BAB III", "KETENTUAN PIDANA", "Pasal 9"],
     [("bab", "BAB III", "KETENTUAN PIDANA"), ("pasal", "Pasal 9", "")], [], S.BODY),
    ("S6", "UU 25/1956", S.PREAMBLE, {"blocks": [("preamble", "Menetapkan")]},
     ["BAB I.", "Tentang Urusan Rumah-Tangga", "dan Kewajiban-Kewajiban", "Pasal 1."],
     [("bab", "BAB I", "Tentang Urusan Rumah-Tangga dan Kewajiban-Kewajiban"), ("pasal", "Pasal 1", "")], [],
     S.BODY),
    ("S7", "Lampiran II item 70", S.BODY, {"last_pasal": 3, "blocks": [("pasal", "Pasal 3")]},
     ["Bagian Kesatu", "Umum"], [("text", "", "Bagian Kesatu Umum")], [], S.BODY),
    ("S7", "Lampiran II item 70", S.BODY, {"last_pasal": 3, "last_bab": 1}, ["Bagian Kesatu", "Umum", "Pasal 4"],
     [("bagian", "Bagian Kesatu", "Umum"), ("pasal", "Pasal 4", "")], [], S.BODY),
    ("S8", "UU 4/2009", S.BODY, {"last_pasal": 1, "blocks": [("pasal", "Pasal 1")]},
     ["(2) Dalam hal", "(1) Setiap orang."], [("text", "", "(2) Dalam hal"), ("ayat", "(1)", "Setiap orang.")], [],
     S.BODY),
    ("S10", "UU 4/2009", S.BODY, {"last_pasal": 1, "blocks": [("pasal", "Pasal 1")]},
     ["huruf b dan", "c. bahwa"], [("text", "", "huruf b dan c. bahwa")], [], S.BODY),
    ("S13", "UU 6/1964", S.FRONT, {}, ["PRESIDEN", "REPUBLIK INDONESIA", "UNDANG-UNDANG No. 6 TAHUN 1964"],
     [("title", "", "UNDANG-UNDANG No. 6 TAHUN 1964")], [], S.FRONT),
    ("S14", "UU 6/1964", S.PREAMBLE, {"blocks": [("preamble", "Mengingat")]}, [": 1. Pasal 5 ayat (1);"],
     [("item", "1.", "Pasal 5 ayat (1);")], [], S.PREAMBLE),
    ("S16", "UU 4/2009", S.BODY, {"last_pasal": 175, "blocks": [("pasal", "Pasal 175")]},
     ["Agar setiap orang mengetahuinya, memerintahkan", "pengundangan Undang-Undang ini.",
      "Disahkan di Jakarta", "pada tanggal 12 Januari 2009"],
     [("closing", "", "Agar setiap orang mengetahuinya, memerintahkan pengundangan Undang-Undang ini."),
      ("closing", "", "Disahkan di Jakarta"), ("closing", "", "pada tanggal 12 Januari 2009")], [], S.CLOSING),
    ("S18", "UU 4/2009", S.CLOSING, {"last_pasal": 9, "blocks": CLOSED, "part": S.BODY}, ["PENJELASAN", "ATAS"],
     [("penjelasan", "", "PENJELASAN ATAS")], [], S.PENJELASAN_UMUM),
    ("S19", "UU 2/1962", S.PENJELASAN_PASAL, {"last_pasal": 13, "p_last_pasal": 5, "blocks": [("p_pasal", "Pasal 5")]},
     ["Cukup jelas.", "Pasal 12.", "Cukup jelas"],
     [("text", "", "Cukup jelas."), ("p_pasal", "Pasal 12", ""), ("text", "", "Cukup jelas")], [],
     S.PENJELASAN_PASAL),
    ("S21", "UU 2/2025", S.PENJELASAN_UMUM, {"last_pasal": 2, "amending_law": True, "blocks": [("umum", "", "Umum")]},
     ["Pasal I", "Angka 1", "Pasal 4", "Cukup jelas."],
     [("p_pasal", "Pasal I", ""), ("p_label", "Angka 1", "Pasal 4 Cukup jelas.")], [], S.PENJELASAN_PASAL_I),
    ("S22", "UU 2/2025", S.PENJELASAN_UMUM, {"last_pasal": 2, "blocks": [("umum", "", "Umum")]},
     ["Kalimat satu.", "Kalimat dua."], [("text", "", "Kalimat satu."), ("text", "", "Kalimat dua.")], [],
     S.PENJELASAN_UMUM),
    ("S23", "UU 13/2022", S.CLOSING, {"last_pasal": 2, "blocks": EXPLAINED, "part": S.PENJELASAN_PASAL},
     ["LAMPIRAN", "PETA WILAYAH", "PENJELASAN"],
     [("lampiran", "LAMPIRAN", ""), ("lampiran_text", "", "PETA WILAYAH"), ("lampiran_text", "", "PENJELASAN")],
     [], S.LAMPIRAN),
    ("S24", "UU 14/2013", S.LAMPIRAN, {"last_pasal": 2, "blocks": [("lampiran", "LAMPIRAN I")]},
     ["Salinan sesuai dengan aslinya", "KEMENTERIAN SEKRETARIAT NEGARA", "LAMPIRAN II", "Tabel"],
     [("lampiran", "LAMPIRAN II", ""), ("lampiran_text", "", "Tabel")], [], S.LAMPIRAN),
    ("S24", "UU 2/2025", S.CLOSING, {"last_pasal": 2, "blocks": CLOSED, "part": S.AMENDING},
     ["Salinan sesuai dengan aslinya", "Kepala Biro", "PENJELASAN"], [("penjelasan", "", "PENJELASAN")],
     ["salinan: copy certified ('Salinan sesuai dengan aslinya'); left out"], S.PENJELASAN_UMUM),
    ("S25", "UU 2/2025", S.SALINAN, {"last_pasal": 2, "blocks": CLOSED, "part": S.BODY, "salinan_lines": 15},
     ["TAMBAHAN"], [("closing", "", "TAMBAHAN")], ["salinan: no end found after 15 lines; text kept"], S.CLOSING),
    ("S26", "UU 14/2013", S.PREAMBLE, {"blocks": [("preamble", "Menetapkan")]}, ["Pasal I", "Beberapa ketentuan"],
     [("pasal", "Pasal I", ""), ("text", "", "Beberapa ketentuan")], [], S.AMENDING),
    ("S27", "UU 18/2025", S.AMENDING, {"last_pasal": 1, "blocks": PASAL_I + [("text", "", "diubah sebagai berikut:")]},
     ["BAB IVA", "Pasal 4", "Pasal II"],
     [("pasal", "Pasal II", "")], [], S.AMENDING),
    ("S28", "UU 16/1953", S.AMENDING, {"last_pasal": 1, "blocks": PASAL_I + [("text", "", "Isi.")]}, ["Pasal 2"],
     [("pasal", "Pasal 2", "")], [], S.BODY),
    ("S29", "UU 2/1953", S.AMENDING, {"last_pasal": 1, "blocks": PASAL_I + [("text", "", "diubah.")]},
     ["diubah.", "Pasal 2"], [("pasal", "Pasal 2", "")], [], S.BODY),
    ("S29", "UU 12/1957", S.AMENDING,
     {"last_pasal": 1, "quoted_one": True, "blocks": PASAL_I + [("text", "", "berbunyi sebagai berikut: Pasal 1")]},
     ["Isi.", "Pasal 2"], [], [], S.AMENDING),
    ("S30", "UU 18/2025", S.FRONT, {"blocks": [("title", "", "PERUBAHAN ATAS UNDANG-UNDANG")]},
     ["Pasal 1", "Beberapa ketentuan dalam Undang-Undang diubah sebagai berikut:"],
     [("pasal", "Pasal I", ""), ("text", "", "Beberapa ketentuan dalam Undang-Undang diubah sebagai berikut:")],
     ["'Pasal 1' read as 'Pasal I' (amending law, OCR)"], S.AMENDING),
    ("S32", "UU 6/1967", S.PENJELASAN_UMUM, {"last_pasal": 1, "blocks": [("penjelasan", "", "PENJELASAN")]},
     ["I.", "UMUM", "Teks."], [("umum", "", "Umum"), ("text", "", "Teks.")], [], S.PENJELASAN_UMUM),
    ("S33", "Lampiran II item 190", S.PENJELASAN_UMUM, {"last_pasal": 1, "blocks": [("umum", "", "Umum")]},
     ["Ayat (1)", "Pasal 1", "Ayat (1)"], [("text", "", "Ayat (1)"), ("p_pasal", "Pasal 1", ""),
                                          ("p_label", "Ayat (1)", "")], [], S.PENJELASAN_PASAL),
    ("G1", "UU 12/2011", S.LAMPIRAN, {"last_pasal": 2, "blocks": [("lampiran", "LAMPIRAN II")]},
     ["Disahkan di Jakarta", "pada tanggal"],
     [("closing", "", "Disahkan di Jakarta"), ("lampiran_text", "", "pada tanggal")], [], S.LAMPIRAN),
    ("G2", "UU 12/2011", S.LAMPIRAN, {"last_pasal": 2, "blocks": [("lampiran", "LAMPIRAN II")]},
     ["Contoh:", "LAMPIRAN I"], [("lampiran_text", "", "Contoh:"), ("lampiran", "LAMPIRAN I", "")], [], S.LAMPIRAN),
    ("S23", "UU 9/2017", S.LAMPIRAN, {"last_pasal": 2, "blocks": ENACTING_PERPPU},
     ["PENJELASAN", "ATAS", "PERATURAN PEMERINTAH", "PENGGANTI UNDANG-UNDANG REPUBLIK INDONESIA", "NOMOR 1 TAHUN 2017",
      "I. UMUM"],
     [("lampiran_text", "", "PENJELASAN"), ("lampiran_text", "", "ATAS"), ("lampiran_text", "", "PERATURAN PEMERINTAH"),
      ("lampiran_text", "", "PENGGANTI UNDANG-UNDANG REPUBLIK INDONESIA"), ("lampiran_text", "", "NOMOR 1 TAHUN 2017"),
      ("lampiran_text", "", "I. UMUM")], [], S.LAMPIRAN),
    ("S23", "UU 9/2017", S.LAMPIRAN, {"last_pasal": 2, "blocks": ENACTING_PERPPU},
     ["PENJELASAN", "ATAS", "UNDANG-UNDANG REPUBLIK INDONESIA", "NOMOR 9 TAHUN 2017", "I. UMUM", "Dalam rangka.",
      "II. PASAL DEMI PASAL", "Pasal 1", "Cukup jelas."],
     [("penjelasan", "", "PENJELASAN ATAS UNDANG-UNDANG REPUBLIK INDONESIA NOMOR 9 TAHUN 2017"),
      ("umum", "", "Umum"), ("text", "", "Dalam rangka."), ("pasal_demi_pasal", "", "Pasal demi Pasal"),
      ("p_pasal", "Pasal 1", ""), ("text", "", "Cukup jelas.")], [], S.PENJELASAN_PASAL),
])
def test_a_state_reads_its_lines(rule, law, state, setup, lines, blocks, warned, after):
    setup = dict(setup)
    assert read(state, lines, setup.pop("blocks", ()), setup.pop("part", None), **setup) == (blocks, warned, after)


def test_the_closing_lies_over_its_part_and_gives_way_to_it():      # RUU drafts: RANCANGAN glued (S17, G4)
    ctx = Context(state=S.CLOSING, part=S.BODY, last_pasal=9)
    ctx.doc.blocks.extend([Block("pasal", "Pasal 9"), Block("closing", text="Disahkan di Jakarta")])
    lines = [classify("RANCANGAN")]
    step(ctx, View(lines, 0))
    assert (ctx.doc.blocks[-1].text, ctx.state) == ("Disahkan di Jakarta RANCANGAN", S.CLOSING)


def test_every_state_reads_every_line():
    assert set(TABLE) == set(State)
    for state, cells in TABLE.items():
        last = cells[-1]
        assert last.kind is None and last.guard is structure.always, state


def test_a_cell_name_is_one_cell():
    cells = {id(c): c for row in TABLE.values() for c in row}.values()
    names = [c.name for c in cells]
    assert len(names) == len(set(names))


def _inventory() -> dict[str, set[str]]:
    """Each id of the Structure and Known gaps tables with the names in its Code (Cell) column."""
    rows = {}
    for line in RULES.read_text(encoding="utf-8").splitlines():
        if m := re.match(r"^\| ([SG]\d+) \|", line):
            code = line.split("|")[-3]                          # Code, or Cell for a gap
            rows[m[1]] = set(re.findall(r"`([\w.]+)`", code))
    return rows


def test_every_rule_sits_in_the_cells_the_inventory_names():
    cells = {c.name: c for row in TABLE.values() for c in row}
    inventory = _inventory()
    for rule, names in inventory.items():
        carrying = {name for name, c in cells.items() if rule in c.ids}
        assert names & cells.keys() == carrying, rule
        for name in names - cells.keys():                        # a function or constant outside the table
            target = structure
            for part in name.split("."):
                target = getattr(target, part)
    assert {i for c in cells.values() for i in c.ids} <= inventory.keys()
