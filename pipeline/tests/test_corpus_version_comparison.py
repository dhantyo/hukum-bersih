"""The comparison of every pair of versions of an amended law, as ``hukum-rapih export-corpus``
writes it to ``collections/<slug>/comparisons`` (hukum_rapih.corpus.version_comparison)."""

import json

import pytest

from hukum_rapih.corpus.version_comparison import comparison_record, write_comparisons

VERSIONS = [{"id": "uu_1_2000", "label": "Teks asli (2000)", "cite": "UU 1/2000", "date": None,
             "gap": 0},
            {"id": "uu_2_2010", "label": "UU 2/2010", "cite": "UU 2/2010", "date": "2010-01-01",
             "gap": 1},
            {"id": "uu_3_2020", "label": "UU 3/2020", "cite": "UU 3/2020", "date": "2020-01-01",
             "gap": 0}]

TAX = "Setiap orang wajib membayar pajak."
# a pasal in each version: its lines as [number, text, indent], "d" (deleted), "u" (its new
# wording is not readable) or None (not there yet)
HISTORY = [
    ["1", [[0, [["(1)", TAX, 0]]], [1, [["(1)", TAX.replace("pajak", "pajak tepat waktu"), 0]]]]],
    ["2", [[0, None], [2, [[None, "Pasal baru.", 0]]]]],
    ["3", [[0, [[None, "Dihapus nanti.", 0]]], [2, "d"]]],
    ["4", [[0, [[None, "Lama.", 0]]], [1, "u"]]],
    ["5", [[0, [[None, "Tetap.", 0]]], [1, [[None, "Tetap.", 0]]]]],
]


def _rows(older: int, newer: int) -> dict[str, dict]:
    return {row["num"]: row for row in comparison_record(HISTORY, older, newer)["pasal"]}


def test_a_pasal_is_listed_with_how_it_stands_in_each_version():
    rows = _rows(0, 2)

    assert {num: (row["before"], row["after"]) for num, row in rows.items()} == {
        "1": ("text", "text"), "2": ("absent", "text"), "3": ("text", "deleted"),
        "4": ("text", "unreadable")}


def test_a_pasal_that_reads_the_same_in_both_versions_is_left_out():
    assert "5" not in _rows(0, 2)


def test_only_the_pasal_a_version_changed_are_listed_between_two_versions():
    assert list(_rows(1, 2)) == ["2", "3"]


def test_changed_wording_is_a_word_diff_of_the_two_texts():
    (line,) = _rows(0, 1)["1"]["lines"]

    assert line["kind"] == "berubah"
    assert [part["value"] for part in line["parts"] if part["added"]] == [" tepat waktu"]
    assert "".join(part["value"] for part in line["parts"] if not part["removed"]).startswith(
        "Setiap orang wajib membayar pajak tepat waktu")


def test_every_line_spells_both_texts_from_its_parts():
    """The law pages read a line's text back from its parts, so they must spell it exactly."""
    (line,) = _rows(0, 1)["1"]["lines"]
    old = "".join(part["value"] for part in line["parts"] if not part["added"])
    new = "".join(part["value"] for part in line["parts"] if not part["removed"])

    assert (old, new) == (TAX, TAX.replace("pajak", "pajak tepat waktu"))


def test_a_new_pasal_is_all_added_and_a_deleted_one_all_removed():
    rows = _rows(0, 2)

    assert [line["kind"] for line in rows["2"]["lines"]] == ["baru"]
    assert [line["kind"] for line in rows["3"]["lines"]] == ["dihapus"]
    assert rows["4"]["lines"][0]["kind"] == "dihapus"


def test_a_comparison_runs_from_the_older_version_to_the_newer():
    with pytest.raises(ValueError, match="not older"):
        comparison_record(HISTORY, 1, 0)


def test_an_ayat_repealed_in_place_is_paired_by_its_number_in_the_numbered_lines():
    ayat = [["(1)", "Lembaga kepolisian nasional berkedudukan di bawah Presiden.", 0],
            ["(2)", "Komisi dibentuk dengan Keputusan Presiden.", 0]]
    repealed = [ayat[0], ["(2)", "Dihapus.", 0]]
    history = [["9", [[0, ayat], [1, repealed]]]]
    (row,) = comparison_record(history, 0, 1)["pasal"]

    assert [line["kind"] for line in row["lines"]] == ["sama", "dihapus", "baru"]
    assert [line["kind"] for line in row["numbered"]] == ["sama", "berubah"]


BUMN_2003 = ("Badan Usaha Milik Negara, yang selanjutnya disebut BUMN, adalah badan usaha yang "
             "seluruh atau sebagian besar modalnya dimiliki oleh negara melalui penyertaan secara "
             "langsung yang berasal dari kekayaan negara yang dipisahkan.")
BUMN_2025 = ("Badan Usaha Milik Negara yang selanjutnya disingkat BUMN adalah badan usaha yang "
             "memenuhi minimal salah satu ketentuan berikut:")


def _marked(line: dict) -> tuple[list[str], list[str]]:
    """The words struck on the old side and highlighted on the new side."""
    return ([p["value"] for p in line["parts"] if p["removed"]],
            [p["value"] for p in line["parts"] if p["added"]])


def test_words_both_versions_keep_stay_unmarked_in_a_mostly_rewritten_line():
    """2026-11-26: UU 19/2003 and UU 1/2025 Pasal 1 angka 1 was struck and highlighted whole
    because under half of it was unchanged, though it opens with the same words."""
    history = [["1", [[0, [["1.", BUMN_2003, 0]]], [1, [["a.", BUMN_2025, 0]]]]]]
    (row,) = comparison_record(history, 0, 1)["pasal"]
    (line,) = row["lines"]

    assert line["kind"] == "berubah"
    struck, highlighted = _marked(line)
    assert struck[:3] == [",", "disebut", ","]
    assert struck[3].startswith("seluruh atau sebagian besar modalnya")
    assert highlighted == ["disingkat", "memenuhi minimal salah satu ketentuan berikut:"]


def test_a_comma_dropped_in_the_newer_text_is_the_only_mark():
    history = [["1", [[0, [[None, "Badan Usaha Milik Negara, adalah badan usaha.", 0]]],
                      [1, [[None, "Badan Usaha Milik Negara adalah badan usaha.", 0]]]]]]
    (line,) = comparison_record(history, 0, 1)["pasal"][0]["lines"]

    assert _marked(line) == ([","], [])


def test_numbered_lines_are_left_out_when_they_pair_the_lines_the_same_way():
    row = _rows(0, 1)["1"]

    assert "numbered" not in row


def test_every_pair_of_versions_has_one_file_older_version_first(tmp_path):
    directory = tmp_path / "comparisons"

    assert write_comparisons(directory, {"versions": VERSIONS, "pasal": HISTORY}) == 3
    assert sorted(path.name for path in directory.iterdir()) == [
        "index.json", "uu_1_2000...uu_2_2010.json", "uu_1_2000...uu_3_2020.json",
        "uu_2_2010...uu_3_2020.json"]
    assert json.loads((directory / "index.json").read_text(encoding="utf-8")) == {
        "versions": VERSIONS}
    pair = json.loads((directory / "uu_1_2000...uu_3_2020.json").read_text(encoding="utf-8"))
    assert [row["num"] for row in pair["pasal"]] == ["1", "2", "3", "4"]


def test_a_version_id_that_is_not_a_file_name_is_refused(tmp_path):
    versions = [{**VERSIONS[0], "id": "../x"}, VERSIONS[1]]

    with pytest.raises(ValueError, match="not a valid name"):
        write_comparisons(tmp_path / "comparisons", {"versions": versions, "pasal": []})
