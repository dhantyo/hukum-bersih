"""The comparison of two draft versions, as ``hukum-bersih export-corpus`` writes it to
``drafts/<slug>/comparisons`` (hukum_bersih.corpus.compare and drafts)."""

import json
from pathlib import Path

import pytest

from hukum_bersih.akn.build import to_akn_tree
from hukum_bersih.corpus.compare import compare, word_diff
from hukum_bersih.corpus.drafts import comparison_rows
from hukum_bersih.corpus.pasal import collect_pasal
from hukum_bersih.corpus.reader_text import reader_text
from hukum_bersih.corpus.write import UNDEFINED

WORD_DIFFS = Path(__file__).parent / "fixtures" / "wordiff_perampasan_aset.json"

OPENING = ("Setiap orang yang menguasai aset hasil tindak pidana wajib melaporkan kepada "
           "penyidik paling lambat tujuh hari sejak aset itu diketahui")
PENALTY = ("Pelaku dipidana dengan pidana penjara paling lama sepuluh tahun dan denda "
           "paling banyak lima miliar rupiah")
FREEZE = ("Pengadilan dapat memerintahkan pemblokiran rekening bank tersangka selama "
          "proses penyidikan berlangsung")
APPEAL = ("Putusan pengadilan negeri dapat dimintakan banding kepada pengadilan tinggi "
          "dalam waktu empat belas hari")


def _article(number: int, *texts: str) -> str:
    if len(texts) == 1:
        return f"    ART {number} -\n      {texts[0]}\n"
    ayat = "\n".join(f"      PARA ({k})\n        {text}\n" for k, text in enumerate(texts, 1))
    return f"    ART {number} -\n{ayat}"


def _pasal(*articles: tuple[int, ...]):
    """The pasal of a bill whose ``articles`` are (number, text, ...) tuples."""
    text = "BODY\n  CHAPTER I - KETENTUAN UMUM\n\n"
    text += "\n".join(_article(number, *texts) for number, *texts in articles)
    tree = to_akn_tree(text, "/akn/id/bill/2026/contoh", root="bill")
    return collect_pasal(reader_text(tree)["body"])


def _rows(old, new):
    return comparison_rows(compare(_pasal(*old), _pasal(*new)))


def test_a_renumbered_pasal_is_paired_with_its_new_number():
    old = [(1, OPENING), (2, PENALTY)]
    new = [(1, OPENING), (2, FREEZE), (3, PENALTY)]

    comparison = compare(_pasal(*old), _pasal(*new))

    renumbered = [r for r in comparison.rows if r.renumbered]
    assert [(r.a.label, r.b.label, r.status) for r in renumbered] == [("Pasal 2", "Pasal 3", "sama")]
    assert comparison.counts == {"sama": 2, "berubah": 0, "baru": 1, "dihapus": 0,
                                 "renumbered": 1, "moved": 0}
    assert [r["anchor"] for r in comparison_rows(comparison)] == [
        "b-chp_I__art_1", "b-chp_I__art_2", "b-chp_I__art_3"]


def test_a_moved_pasal_is_shown_once_where_it_came_from():
    old = [(1, OPENING), (2, PENALTY), (3, FREEZE)]
    new = [(1, FREEZE), (2, OPENING), (3, PENALTY)]

    comparison = compare(_pasal(*old), _pasal(*new))

    moved = [r for r in comparison.rows if r.moved]
    assert [(r.a.label, r.b.label) for r in moved] == [("Pasal 3", "Pasal 1")]
    assert len(comparison.rows) == 3
    assert comparison.counts["moved"] == 1


SHARED = "alfa bravo charlie delta echo"


@pytest.mark.parametrize(("new_words", "weak"), [
    ("foxtrot golf hotel india juliet kilo lima mike", True),     # 4 of 12 word pairs alike
    ("foxtrot golf hotel india juliet kilo", False),              # 4 of 9 pairs alike
])
def test_a_barely_alike_pair_is_flagged_weak(new_words, weak):
    old = f"{SHARED} november oscar papa quebec romeo sierra tango uniform"

    [row] = _rows([(1, old)], [(1, f"{SHARED} {new_words}")])

    assert row["status"] == "berubah"
    assert row["weak"] is weak


def test_a_split_pasal_points_each_side_at_the_other():
    old = [(1, OPENING, PENALTY)]
    new = [(1, OPENING), (2, PENALTY)]

    removed, added = _rows(old, new)

    [_, gone] = removed["lines"]
    assert gone["kind"] == "dihapus"
    assert gone["ref"] == {"label": "Pasal 2", "side": "b", "anchor": added["anchor"]}
    [new_line] = added["lines"]
    assert new_line["kind"] == "baru"
    assert new_line["ref"] == {"label": "Pasal 1 ayat (2)", "side": "a", "anchor": removed["anchor"]}


def test_the_chapter_heading_is_only_on_the_row_that_opens_the_chapter():
    rows = _rows([(1, OPENING), (2, PENALTY)], [(1, OPENING), (2, PENALTY)])

    assert [r["chapter"] for r in rows] == ["BAB I", UNDEFINED]


def test_word_diffs_of_400_real_paragraph_pairs_match_the_javascript_engine():
    """The fixture holds ``@sanity/diff-match-patch``'s output (the engine ``compare.ts`` used)
    for 400 changed paragraph pairs of the two drafts of RUU Perampasan Aset, as
    (0 equal, -1 removed, 1 added, text); the two texts are what its parts spell."""
    expected = json.loads(WORD_DIFFS.read_text(encoding="utf-8"))
    identical = 0

    for js in expected:
        old = "".join(text for flag, text in js if flag <= 0)
        new = "".join(text for flag, text in js if flag >= 0)
        parts = word_diff(old, new)
        assert "".join(p.value for p in parts if not p.added) == old
        assert "".join(p.value for p in parts if not p.removed) == new
        identical += [[1 if p.added else -1 if p.removed else 0, p.value] for p in parts] == js

    assert len(expected) == 400
    assert identical >= 360      # 375 on 2026-11-25; the rest group the same edits differently
