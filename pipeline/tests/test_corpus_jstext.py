"""The JavaScript string rules the corpus text relies on (hukum_bersih.corpus.jstext)."""

from hukum_bersih.corpus.jstext import collapse, judul, locale_key, slugify


def test_whitespace_is_what_javascript_calls_whitespace():
    # NBSP and the byte-order mark are whitespace to JavaScript; U+001F is not
    assert collapse("﻿ Pasal  5 \n ayat\x1f(1)　") == "Pasal 5 ayat\x1f(1)"


def test_titles_keep_acronyms_and_small_words():
    assert judul("PELINDUNGAN SAKSI DAN KORBAN") == "Pelindungan Saksi dan Korban"
    assert judul("  PERUBAHAN ATAS UU ITE DAN PP III") == "Perubahan atas UU ITE dan PP III"
    assert judul("BAB III") == "Bab III"


def test_slug_drops_accents_and_edges():
    assert slugify("Café: Pajak & Retribusi!") == "cafe-pajak-retribusi"


def test_names_sort_without_regard_to_case_and_accents():
    names = ["UU PT", "Desa", "administrasi", "Éksport", "UU ITE", "Anggaran 2010", "Anggaran-2009"]

    assert sorted(names, key=locale_key) == [
        "administrasi", "Anggaran 2010", "Anggaran-2009", "Desa", "Éksport", "UU ITE", "UU PT"]
