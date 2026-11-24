"""OCR spell fix (pdf/ocr_fix.py): real cases from scanned UU read with Indra, 2026-11-24."""

import shutil
import subprocess

import pytest

from hukum_bersih.pdf import ocr_fix
from hukum_bersih.pdf.ocr_fix import fix_lines


def _has_dictionaries() -> bool:
    if not shutil.which("hunspell"):
        return False
    run = subprocess.run(["hunspell", "-d", ocr_fix.DICTIONARIES, "-G"], input="rumah",
                         capture_output=True, text=True, check=False)
    return run.stdout.strip() == "rumah"


needs_hunspell = pytest.mark.skipif(not _has_dictionaries(), reason="Hunspell id_ID/en_US missing")

# The law prints the right word elsewhere: each case gets its word twice in the context.
CONTEXT = ("keselamatan anggaran daerah Daerah diwujudkan wilayah ketuhanan lingkungan masyarakat dalam"
           " Indonesia Huruf Provinsi pidana Selatan Kota ") * 2

MISREADS = [                                   # read -> meant (Indra, sample of 2026-11-24)
    ("keselamalan", "keselamatan"),            # UU 3/2020
    ("anggarah", "anggaran"),                  # UU 1/2022
    ("dacrah", "daerah"),                      # UU 120/2024
    ("Dacrah", "Daerah"),                      # capitalised: shape confusion c/e only
    ("divujudkan", "diwujudkan"),              # UU 12/2022
    ("keuuhanan", "ketuhanan"),
    ("wilayan", "wilayah"),                    # UU 8/2023
    ("lndonesia", "Indonesia"),                # capital I read as l (UU 18/2025)
    ("Hurufj", "Huruf j"),                     # a point label without its space (UU 1/2022)
    ("hurufb", "huruf b"),
    ("llngkungan", "lingkungan"),
    ("rnasyarakat", "masyarakat"),             # shape confusion "rn" for "m"
    ("RNASYARAKAT", "MASYARAKAT"),             # case kept
    ("dalarn", "dalam"),
]

AS_READ = [                                    # real words, names, numbers: never changed
    "kelab", "rerata", "arena", "hostel", "Rail",      # Hunspell knows them
    "Gamping", "Talun", "Serbia",                     # place and country names
    "perundungan",                                    # lexicon-extra.txt
    "jang", "Djakarta", "Nopember", "PENDJELASAN",    # old spelling (text fidelity)
    "XIIA", "XIV",                                    # Roman numerals (BAB XIIA)
    "1O", "2OO2",                                     # numbers are never touched
    "PresiDen",                                       # mixed case
    "dl",                                             # too short to judge
    "Provinsii",                                      # "Provinsi" with a subscript i
    "pindana",                                        # a letter added: never deleted
    "Sepatan", "Sota",                                # district names (Kec. Sepatan, UU 7/2023)
]


@needs_hunspell
@pytest.mark.parametrize("read,meant", MISREADS)
def test_clear_misreads_are_corrected(read, meant):
    lines, fixes = fix_lines([CONTEXT, f"menurut {read} ini"])
    assert lines[1] == f"menurut {meant} ini"
    assert fixes.changed == [(read, meant)]


@needs_hunspell
@pytest.mark.parametrize("word", AS_READ)
def test_real_words_are_left_as_read(word):
    lines, fixes = fix_lines([CONTEXT, f"menurut {word} ini"])
    assert lines[1] == f"menurut {word} ini"
    assert fixes.changed == []


@needs_hunspell
def test_a_word_the_law_repeats_is_taken_as_real():
    """'Perkada' (Peraturan Kepala Daerah) is one edit from 'perkara' and in no dictionary."""
    lines = [CONTEXT, "perkara perkara", "Perkada", "Perkada", "Perkada"]
    out, fixes = fix_lines(lines)
    assert out == lines
    assert fixes.suspects == ["Perkada"] * 3


@needs_hunspell
def test_no_correction_unless_the_law_has_the_word_elsewhere():
    out, fixes = fix_lines(["menurut keselamalan ini"])
    assert out == ["menurut keselamalan ini"]
    assert fixes.suspects == ["keselamalan"]


@needs_hunspell
def test_a_common_word_needs_no_second_occurrence():
    """Short laws may print "setelah" once (seen in the CI report of 2026-11-24)."""
    out, _ = fix_lines(["seteiah itu, ini merupakan"])
    assert out == ["setelah itu, ini merupakan"]


LOOKALIKES = [                                 # read -> mapped (a letter of another script)
    ("meningkatkarı", "meningkatkari"),        # Turkish dotless ı (Indra, CI 2026-11-24)
    ("Ρasal", "Pasal"),                        # Greek capital Rho
    ("раsal", "pasal"),                        # Cyrillic р, а
    ("ΡASAL", "PASAL"),
]

UNCHANGED = ["ıı", "Ρασ", "привет", "“kutipan”", "§", "½", "1ı", "café", "Zürich", "Pasal 5 ayat (1)"]


@pytest.mark.parametrize("read,mapped", LOOKALIKES)
def test_a_lookalike_letter_in_a_latin_word_is_mapped(read, mapped):
    lines, fixes = fix_lines([f"menurut {read} ini"])
    assert lines == [f"menurut {mapped} ini"]
    assert fixes.changed[0] == (read, mapped)


@pytest.mark.parametrize("text", UNCHANGED)
def test_other_characters_are_never_changed(text):
    lines, fixes = fix_lines([f"menurut {text} ini"])
    assert lines == [f"menurut {text} ini"]
    assert all(read != text for read, _ in fixes.changed)


@needs_hunspell
@pytest.mark.parametrize("read,meant", [         # Indra-read UU on main, 2026-11-24
    ("BАB", "BAB"),                                  # Cyrillic А: a BAB heading the parser missed
    ("հuruf", "huruf"),                              # Armenian h
    ("Ꭺnak", "Anak"),                                # Cherokee A
])
def test_real_lookalikes_are_mapped(read, meant):
    lines, fixes = fix_lines([f"menurut {read} ini"])
    assert lines == [f"menurut {meant} ini"]
    assert (read, meant) in fixes.changed


def test_only_letters_the_standard_calls_lookalikes():
    """UTS #39 maps Cyrillic р/а but not и (no Latin lookalike) and not dotted İ: "Рариa"
    (Papua) and "İbu" from Indra stay partly unmapped; no hand-made exceptions."""
    assert fix_lines(["Рариa İbu"])[0] == ["Papиa İbu"]


def test_french_and_accented_words_are_kept():
    """BPK's texts quote French titles (République, française); OCR's own accents stay too."""
    line = "République française RÉPUBLIQUE Ekönomi"
    assert fix_lines([line])[0] == [line]


def test_without_hunspell_nothing_is_corrected(monkeypatch):
    monkeypatch.setattr(ocr_fix.shutil, "which", lambda _: None)
    out, fixes = fix_lines([CONTEXT, "menurut keselamalan ini"])
    assert out[1] == "menurut keselamalan ini"
    assert fixes.checker == "none" and fixes.suspects == ["keselamalan"]
