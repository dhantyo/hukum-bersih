"""``hukum-rapih explain``: the trace names the cell and states the driver really used, and
watching does not change what the parser makes."""

import dataclasses

from hukum_rapih import cli
from hukum_rapih.pdf.explain import report, select, trace
from hukum_rapih.pdf.structure import State as S
from hukum_rapih.pdf.structure import parse_lines

# UU 9/2017 prints Perppu 1/2017 whole, its Penjelasan too, as its Lampiran; only the heading
# naming the law itself (NOMOR 9 TAHUN 2017) opens the law's own Penjelasan (S23)
UU_9_2017 = [
    "UNDANG-UNDANG REPUBLIK INDONESIA NOMOR 9 TAHUN 2017 TENTANG PENETAPAN",
    "Pasal 1", "Isi.", "Pasal 2", "Isi.", "LAMPIRAN",
    "PENJELASAN", "ATAS", "PERATURAN PEMERINTAH", "PENGGANTI UNDANG-UNDANG REPUBLIK INDONESIA",
    "NOMOR 1 TAHUN 2017", "I. UMUM",
    "PENJELASAN", "ATAS", "UNDANG-UNDANG REPUBLIK INDONESIA", "NOMOR 9 TAHUN 2017",
    "I. UMUM", "Dalam rangka.", "II. PASAL DEMI PASAL", "Pasal 1", "Cukup jelas.",
]


def test_the_trace_names_the_cell_and_the_states_of_each_line():
    _, events = trace(UU_9_2017)
    read = [(e.at + 1, e.before, e.cell.name, e.after) for e in events]
    assert read[0] == (1, S.FRONT, "title", S.FRONT)
    assert read[1] == (2, S.FRONT, "pasal_first", S.BODY)
    assert read[5] == (6, S.BODY, "lampiran_opens", S.LAMPIRAN)
    # the Perppu's Penjelasan stays in the Lampiran, the law's own leaves it
    assert {c for n, _, c, _ in read if 7 <= n <= 12} == {"lampiran_text"}
    assert read[12] == (13, S.LAMPIRAN, "penjelasan_in_lampiran", S.PENJELASAN_UMUM)
    assert read[-2] == (20, S.PENJELASAN_UMUM, "p_pasal", S.PENJELASAN_PASAL)
    assert read[-1] == (21, S.PENJELASAN_PASAL, "text", S.PENJELASAN_PASAL)
    heading = events[12]
    assert heading.cell.ids == ("S23",)
    assert "penjelasan" in heading.line.kinds


def test_watching_does_not_change_what_the_parser_makes():
    seen = []
    watched = parse_lines(UU_9_2017, seen.append)
    plain = parse_lines(UU_9_2017)
    assert seen
    assert [dataclasses.astuple(b) for b in watched.blocks] == [dataclasses.astuple(b) for b in plain.blocks]
    assert watched.warnings == plain.warnings


def test_a_line_read_again_is_reported_once_per_cell():      # UU 16/1953: Pasal 2 ends the amending part (S28)
    _, events = trace(["Menetapkan:", "Pasal I", "Beberapa ketentuan", "Isi.", "Pasal 2", "Isi."])
    again = [(e.at + 1, e.before, e.cell.name, e.after, e.used) for e in events if e.at == 4]
    assert again == [(5, S.AMENDING, "own_pasal_2", S.BODY, 0), (5, S.BODY, "pasal", S.BODY, 1)]
    assert "(read again)" in report(events[4:5])


def test_select_limits_by_line_state_and_cell():
    _, events = trace(UU_9_2017)
    assert {e.at + 1 for e in select(events, 6, 8)} == {6, 7, 8}
    assert {e.before for e in select(events, states=["lampiran"])} == {S.LAMPIRAN}
    assert {e.cell.name for e in select(events, cells=["p_pasal", "part"])} == {"p_pasal", "part"}
    assert select(events, 5, 4) == []


def test_the_command_explains_a_stored_text(tmp_path, capsys):
    text = tmp_path / "law.txt"
    text.write_text("PREFACE\nJudul\nBODY\nART 1 -\n  Isi.\n", encoding="utf-8")
    assert cli.main(["explain", str(text), "--cell", "text"]) == 0
    out = capsys.readouterr().out
    assert "stored text" in out
    assert "state before" in out
    assert "Isi." in out
    assert "pasal_first" not in out


def test_an_unknown_law_says_where_it_looked(tmp_path, capsys, monkeypatch):
    monkeypatch.setenv("HUKUM_RAPIH_PDF_CACHE", str(tmp_path / "pdf"))
    assert cli.main(["--data-dir", str(tmp_path), "explain", "uu_1_1900"]) == 1
    assert "no cached PDF" in capsys.readouterr().err
