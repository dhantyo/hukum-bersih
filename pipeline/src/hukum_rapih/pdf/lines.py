"""What a single cleaned line is, read from its text alone: rules L1-L24 of
``docs/parser-rules.md`` ("Line classification").

Two registries, each entry carrying its inventory ids, the law that caused it and its test:

- ``JOIN_PASAL`` and ``REPAIRS``: heading lines read the same whatever their printing
  (``normalise``);
- ``RULES``: one context-free predicate per line class (``classify``).

A line can be of several classes (``PENJELASAN UMUM`` is a Penjelasan heading and opens Umum;
``Pasal 5`` is a heading or a reference); which one counts is the structure layer's choice,
from what came before. This layer has no state.
"""

from __future__ import annotations

import re
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from enum import StrEnum

Fields = tuple[str, ...]


class Kind(StrEnum):
    BAB = "bab"
    BAGIAN = "bagian"
    PARAGRAF = "paragraf"
    PASAL = "pasal"
    AYAT = "ayat"
    LIST_ITEM = "list_item"
    PREAMBLE = "preamble"
    OPENING = "opening"
    CREST_CAPTION = "crest_caption"
    PENJELASAN = "penjelasan"
    PENJELASAN_UMUM = "penjelasan_umum"
    PENJELASAN_PART = "penjelasan_part"
    PENJELASAN_LABEL = "penjelasan_label"
    CLOSING = "closing"
    LAMPIRAN = "lampiran"
    SALINAN = "salinan"


@dataclass(frozen=True)
class Line:
    """A cleaned line and the classes it matches, each with the fields it captured."""

    text: str
    kinds: Mapping[Kind, Fields]

    def get(self, kind: Kind) -> Fields | None:
        return self.kinds.get(kind)

    def __contains__(self, kind: Kind) -> bool:
        return kind in self.kinds


@dataclass(frozen=True)
class Rule:
    kind: Kind
    ids: tuple[str, ...]
    cause: str
    test: str
    match: Callable[[str], Fields | None]


@dataclass(frozen=True)
class Repair:
    ids: tuple[str, ...]
    cause: str
    test: str
    fix: Callable[[str], str]


def _regex(pattern: str, fields: Callable[[re.Match], Fields] = lambda m: m.groups(), flags: int = 0):
    rx = re.compile(pattern, flags)

    def match(text: str) -> Fields | None:
        return fields(m) if (m := rx.match(text)) else None

    return match


def _first(*matchers: Callable[[str], Fields | None]) -> Callable[[str], Fields | None]:
    def match(text: str) -> Fields | None:
        return next((f for m in matchers if (f := m(text)) is not None), None)

    return match


# --------------------------------------------------------------------------- repairs (L1-L5)

PASAL_NUMBER_ALONE_RE = re.compile(r"^\d+[A-Z]?\.?$")
OCR_DIGITS_RE = re.compile(r"^((?:PASAL|Pasal)\s*)([0-9SOolI|]*[0-9][0-9SOolI|]*)([A-Z]?\.?)$")
# not "Pasal 5," or "Pasal 5;" without a space: a reference broken onto its own line
SPECKS_RE = re.compile(r"^[^\w\s(]{0,2}\s*((?:PASAL|Pasal)\s*[0-9IVXLC]+[A-Z]?)(?:\s*[\'‘’`´.|:]{1,2}|\s+[^\w\s]{1,2})?$")
HEAD_DOT_RE = re.compile(r"^((?:BAB|Bab|BAGIAN|Bagian|PARAGRAF|Paragraf|Pasal|PASAL)\s+\S+?)\s*\.$")
GLUED_PASAL_RE = re.compile(r"^(?:PASAL|Pasal)\s*(\d+[A-Z]?|[IVXLC]+)$")


def _ocr_digits(line: str) -> str:
    m = OCR_DIGITS_RE.match(line)
    return m[1] + m[2].translate(str.maketrans("SOolI|", "500111")) + m[3] if m else line


def _specks(line: str) -> str:
    return m[1] if (m := SPECKS_RE.match(line)) else line


def _head_dot(line: str) -> str:
    return m[1] if (m := HEAD_DOT_RE.match(line)) else line


def _glued_pasal(line: str) -> str:
    return f"Pasal {m[1]}" if (m := GLUED_PASAL_RE.match(line)) else line


# applied in this order to every line not joined by L1
REPAIRS = (
    Repair(("L2",), "UU 12/2022 (v12): OCR's letters for digits, 'Pasal S1', 'Pasal 1lA'",
           "test_headings::test_ocr_letters_for_digits_and_spaced_marks_in_headings", _ocr_digits),
    Repair(("L3",), "UU 135/2024, 29/2024, 11/2022 (v10-12): OCR specks, \"' Pasal 8\", 'Pasal 4 :'",
           "test_headings::test_ocr_speck_before_a_pasal_heading", _specks),
    Repair(("L4",), "UU 25/1956, 6/1964 (v5): a heading's full stop, 'Pasal 1.', 'BAB I.'",
           "test_headings::test_headings_with_a_full_stop_and_old_numbering", _head_dot),
    Repair(("L5",), "UU 18/2025 (v7), OCR: 'PasalI', 'PASAL 3', 'Pasal12'",
           "test_headings::test_ocr_glued_or_capital_pasal_heading_is_read_as_pasal_n", _glued_pasal),
)


# "Pasal" alone on a line, then its number: one heading
JOIN_PASAL = Repair(("L1",), "scans, UU 18/2025 (v5)", "test_headings::test_pasal_number_on_its_own_line",
                    lambda number: f"Pasal {number.rstrip('.')}")


def normalise(lines: list[str]) -> list[str]:
    """Read headings the same whatever their printing: ``JOIN_PASAL``, then ``REPAIRS`` on
    every line not joined. Only heading lines change."""
    out: list[str] = []
    for line in lines:
        if out and out[-1] in ("Pasal", "PASAL") and PASAL_NUMBER_ALONE_RE.match(line):
            out[-1] = JOIN_PASAL.fix(line)
            continue
        for repair in REPAIRS:
            line = repair.fix(line)
        out.append(line)
    return out


# --------------------------------------------------------------------------- classes (L6-L24)

CREST_CAPTION = {"PRESIDEN", "REPUBLIK INDONESIA", "PRESIDEN REPUBLIK INDONESIA", "SALINAN"}


RULES = (
    Rule(Kind.BAB, ("L6", "L7"), "all; 'Bab Pertama' in the 1950s (v5)",
         "test_headings::test_headings_with_a_full_stop_and_old_numbering, test_bab_numbered_in_words",
         _regex(r"^(?:BAB|Bab)\s+([IVXLC]+|Pertama|Kesatu|Ke(?:dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh))$")),
    Rule(Kind.BAGIAN, ("L8",), "all; Roman in the 1950s (v5)",
         "test_headings::test_bagian_and_paragraf_have_one_title_line_and_need_a_bab",
         _regex(r"^(?:Bagian|BAGIAN)\s+(Ke\w+|KE\w+|Pertama|PERTAMA|[IVXLC]+)$")),
    Rule(Kind.PARAGRAF, ("L9",), "all",
         "test_headings::test_bagian_and_paragraf_have_one_title_line_and_need_a_bab",
         _regex(r"^(?:Paragraf|PARAGRAF)\s+(\d+)$")),
    Rule(Kind.PASAL, ("L10",), "all", "test_structure::test_structure",
         _regex(r"^Pasal\s+(\d+[A-Z]?|[IVXLC]+)$")),
    Rule(Kind.AYAT, ("L11",), "all", "test_structure::test_cross_reference_is_not_a_heading",
         _regex(r"^\((\d+)\)\s*(.*)$")),
    Rule(Kind.LIST_ITEM, ("L12",), "all", "test_structure::test_hyphen_join_and_nesting",
         _first(_regex(r"^([a-z])\.\s*(.*)$", lambda m: ("letter", m[1], m[2])),
                _regex(r"^(\d{1,3})\.\s*(.*)$", lambda m: ("number", m[1], m[2])))),
    Rule(Kind.PREAMBLE, ("L13",), "all", "test_headings::test_preamble_lists_on_the_label_line_and_after_a_colon",
         _regex(r"^(Menimbang|Mengingat|Menetapkan|MEMUTUSKAN|Memutuskan|Dengan [Pp]ersetujuan(?: [Bb]ersama)?)\s*:?\s*(.*)$")),
    Rule(Kind.OPENING, ("L14",), "all", "test_headings::test_enacting_formula_lines_are_preamble_not_title",
         _regex(r"^(?:DENGAN RAHMAT TUHAN YANG MAHA ESA|PRESIDEN REPUBLIK INDONESIA,?)$")),
    Rule(Kind.CREST_CAPTION, ("L15",), "UU 6/1964 (v5)", "test_headings::test_crest_caption_is_not_the_title",
         lambda text: () if text.upper() in CREST_CAPTION else None),
    # "PENJELASAN ATAS UNDANG-UNDANG No. 6 TAHUN 1967": the citation in capitals may follow on
    # the same line, its "No." not in capitals
    Rule(Kind.PENJELASAN, ("L16",), "UU 1/1945, 3/1949, 4/1956, 6/1967 (v3, v7)",
         "test_penjelasan::test_penjelasan_heading_with_a_full_stop, test_penjelasan_with_lettered_sections",
         _regex(r"^(?:RANCANGAN\s+|MEMORI\s+)?PEND?JELASAN\.?(?:\s+ATAS)?(?:\s+(?:[A-Z0-9 .,/()-]|No\.)+)?$")),
    Rule(Kind.PENJELASAN_UMUM, ("L17",), "UU 25/1956 (v5)", "test_penjelasan::test_penjelasan_umum_on_one_line",
         _regex(r"^(PEND?JELASAN)\s+UMUM\.?$")),
    # the part of a Penjelasan a line names: "" for a numeral on its own line before the name
    Rule(Kind.PENJELASAN_PART, ("L18", "L19"), "UU 6/1967, 2/2025 (v8); Penjelasan layout",
         "test_penjelasan::test_penjelasan_with_lettered_sections, "
         "test_penjelasan_sections_with_the_numeral_on_its_own_line",
         _first(_regex(r"^(?:I|II)\.$", lambda m: ("",)),
                _regex(r"^(?:[I1l]\.\s*|A\.\s*)?(?:PEND?JELASAN\s+)?UMUM\.?$", lambda m: ("umum",)),
                _regex(r"^(?:II\.\s*|B\.\s*)?(?:PEND?JELASAN\s+)?PASAL DEMI PASAL\.?$",
                       lambda m: ("pasal_demi_pasal",)))),
    Rule(Kind.PENJELASAN_LABEL, ("L20",), "all", "test_penjelasan::test_penjelasan_labels_for_ayat_huruf_and_angka",
         _first(_regex(r"^Ayat\s+\((\d+)\)\s*(.*)$", lambda m: (f"Ayat ({m[1]})", m[2])),
                _regex(r"^Huruf\s+([a-z])\s*(.*)$", lambda m: (f"Huruf {m[1]}", m[2])),
                _regex(r"^Angka\s+(\d+)\s*(.*)$", lambda m: (f"Angka {m[1]}", m[2])))),
    # old spelling (Ejaan Lama) and OCR: "Djakarta, tanggal 23 Nopember 1945", "Disjahkan di"
    Rule(Kind.CLOSING, ("L21", "L22"), "UU 4/2009, 25/1956, 1/1945 (v3, v5); old spelling, OCR",
         "test_closing::test_closing_kept_line_by_line, test_closing_variants_end_the_last_pasal",
         _regex(r"^(?:Agar (?:supaya )?setiap orang (?:dapat )?mengetahui(?:nja|nya)|Disahka[nh] di|Disjahkan di|"
                r"Diundangkan di|Diundangkan pada|Diumumkan|Ditetapkan di|Dikeluarkan di|"
                r"D[j]?akarta,? (?:pada )?tanggal|"
                r"LEMBARAN NEGARA REPUBLIK INDONESIA TAHUN|TAMBAHAN LEMBARAN NEGARA)")),
    Rule(Kind.LAMPIRAN, ("L23",), "UU 14/2013 (v7)", "test_penjelasan::test_lampiran_after_the_penjelasan",
         _regex(r"^LAMPIRAN(?:\s+[IVXLC]+)?$")),
    Rule(Kind.SALINAN, ("L24",), "UU 14/2013, 2/2025 (v7)",
         "test_penjelasan::test_penjelasan_after_the_copy_certification_is_kept",
         _regex(r"^Salinan sesuai dengan aslinya", flags=re.IGNORECASE)),
)


def classify(text: str) -> Line:
    return Line(text, {r.kind: f for r in RULES if (f := r.match(text)) is not None})
