"""A lark prototype for the inline references layer (docs/parser-rules.md, "Inline references").
lark is not a dependency; run with it added for the run only:

    uv run --with lark==1.2.2 python scripts/refs_prototype.py [stored text ...]

A grammar for reference phrases ("Pasal 4 ayat (2) huruf a", "Pasal 5 sampai dengan Pasal 9",
"Undang-Undang Nomor 6 Tahun 2011 tentang"), run at each anchor in a line, keeping the longest
prefix the grammar accepts. Prints the phrases found in UU 12/2011 Lampiran II's examples, then
counts over the stored texts given.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

from lark import Lark, Token
from lark.exceptions import UnexpectedInput

# --------------------------------------------------------------------------- refs

REFS = r"""
start: refs law? | law
refs: unit (sep unit)*
sep: COMMA | COMMA? AND | COMMA? OR | COMMA? ANDOR | RANGE
unit: pasal sub* | sub+
pasal: PASAL NUM
sub: AYAT LPAR NUM RPAR | HURUF LETTER | ANGKA NUM
law: KIND (NOMOR NUM)? (TAHUN YEAR)? TENTANG?
%declare PASAL AYAT HURUF ANGKA NUM LETTER LPAR RPAR COMMA AND OR ANDOR RANGE KIND NOMOR TAHUN
%declare YEAR TENTANG
"""
WORDS = [
    ("KIND", (r"Undang-Undang Dasar Negara Republik Indonesia Tahun 1945|Peraturan Pemerintah"
             r" Pengganti Undang-Undang|Peraturan Pemerintah|Peraturan Presiden|Undang-Undang")),
    ("RANGE", r"sampai dengan"), ("ANDOR", r"dan/atau"), ("AND", r"dan"), ("OR", r"atau"),
    ("PASAL", r"Pasal"), ("AYAT", r"ayat"), ("HURUF", r"huruf"), ("ANGKA", r"angka"),
    ("NOMOR", r"Nomor|No\."), ("TAHUN", r"Tahun"), ("TENTANG", r"tentang"),
    ("YEAR", r"(?:19|20)\d\d(?!\d)"), ("NUM", r"\d+[A-Z]?(?!\w)|[IVX]+(?!\w)"),
    ("LETTER", r"[a-z](?!\w)"), ("LPAR", r"\("), ("RPAR", r"\)"), ("COMMA", r","),
]
WORD_RE = re.compile("|".join(f"(?P<{name}>{rx})" for name, rx in WORDS))
ANCHOR = re.compile(r"\b(?:Pasal \d|ayat \(\d|huruf [a-z]\b|angka \d|Undang-Undang|"
                    r"Peraturan Pemerintah|Peraturan Presiden)")
EXAMPLES = [  # UU 12/2011 Lampiran II items 44, 47, 272, 273, 274, 276, 283
    ("Mengingat: Pasal 5 ayat (1) dan Pasal 20 Undang-Undang Dasar Negara Republik Indonesia "
    "Tahun 1945;"),
    ("2. Undang-Undang Nomor 6 Tahun 2011 tentang Keimigrasian (Lembaran Negara Republik "
    "Indonesia Tahun 2011 Nomor 52);"),
    ("Dalam melaksanakan kewenangan sebagaimana dimaksud dalam Pasal 4 ayat (2) huruf a, "
    "penyelenggara"),
    "sebagaimana dimaksud dalam Pasal 5 sampai dengan Pasal 9 diatur dengan Peraturan Bank",
    "berlaku juga bagi tahanan, kecuali ayat (4) huruf a.",
    ("(3) Izin sebagaimana dimaksud pada ayat (1), Pasal 7 ayat (2) dan ayat (4), Pasal 12, dan "
    "Pasal 13 ayat (3) diajukan"),
    ("Peraturan Pemerintah Nomor 23 Tahun 2010 tentang Pelaksanaan dinyatakan tetap berlaku, "
    "kecuali Pasal 5 sampai dengan Pasal 10"),
]


def words(text: str, pos: int):
    while True:
        while pos < len(text) and text[pos] == " ":
            pos += 1
        m = WORD_RE.match(text, pos)
        if not m:
            return
        yield Token(m.lastgroup, m[0], start_pos=m.start(), end_pos=m.end())
        pos = m.end()


def longest(parser: Lark, text: str, pos: int) -> int | None:
    """End of the longest phrase from ``pos`` that the grammar accepts."""
    ip, end = parser.parse_interactive(""), None
    for tok in words(text, pos):
        try:
            ip.feed_token(tok)
        except UnexpectedInput:
            break
        if "$END" in ip.accepts():
            end = tok.end_pos
    return end


def phrases(parser: Lark, text: str) -> list[str]:
    out, pos = [], 0
    while m := ANCHOR.search(text, pos):
        end = longest(parser, text, m.start())
        if end:
            out.append(text[m.start():end])
        pos = end or m.end()
    return out


def refs(paths: list[str]) -> None:
    parser = Lark(REFS, parser="lalr", lexer="basic")
    for text in EXAMPLES:
        print(phrases(parser, text))
    anchors = found = 0
    for path in paths:
        for line in Path(path).read_text().splitlines():
            anchors += len(ANCHOR.findall(line))
            found += len(phrases(parser, line))
    if paths:
        print(f"{len(paths)} text(s): {anchors} anchors, {found} phrases")


if __name__ == "__main__":
    refs(sys.argv[1:])
