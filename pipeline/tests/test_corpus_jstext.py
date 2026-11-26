"""The JavaScript string rules the corpus text relies on (hukum_bersih.corpus.jstext)."""

import random
import re
import sys

from hukum_bersih.corpus.jstext import WS, WS_CHARS, collapse, judul, locale_key, slugify, trim


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


def test_the_whitespace_characters_are_those_of_the_pattern():
    pattern = re.compile(WS)
    matched = {chr(c) for c in range(sys.maxunicode + 1)
               if not 0xD800 <= c <= 0xDFFF and pattern.fullmatch(chr(c))}
    assert set(WS_CHARS) == matched


def test_trim_and_collapse_match_the_javascript_regexes():
    # String.trim() and .replace(/\s+/g, " ").trim(), written as the regexes they stand for
    edge, run = re.compile(f"^{WS}+|{WS}+$"), re.compile(f"{WS}+")
    alphabet = [*WS_CHARS, "a", "B", "5", "(", ".", "\x1f", "\x1c", "é"]
    rng = random.Random(0)
    for _ in range(5000):
        text = "".join(rng.choice(alphabet) for _ in range(rng.randrange(12)))
        assert trim(text) == edge.sub("", text)
        assert collapse(text) == edge.sub("", run.sub(" ", text))
