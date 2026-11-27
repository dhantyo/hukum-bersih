"""Two lark prototypes for the parser rewrite (docs/parser-rules.md, "Design for the rewrite").
lark is not a dependency; run with it added for the run only:

    uv run --with lark==1.2.2 python scripts/grammar_prototype.py blocks [law ...]
    uv run --with lark==1.2.2 python scripts/grammar_prototype.py refs [stored text ...]

``blocks``: each cleaned line of a regression-set PDF (tests/regression.yaml, cached by
scripts/regress.py) is classified by the current regexes alone, with no sequence check, and a
context-free grammar builds the tree. Prints the body pasal it finds next to the current parser
and the expected count. Scanned PDFs are read through their own text layer (no OCR).

``refs``: a grammar for reference phrases ("Pasal 4 ayat (2) huruf a", "Pasal 5 sampai dengan
Pasal 9", "Undang-Undang Nomor 6 Tahun 2011 tentang"), run at each anchor in a line, keeping the
longest prefix the grammar accepts. Prints the phrases found in UU 12/2011 Lampiran II's
examples, then counts over the stored texts given.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import yaml
from lark import Lark, Token
from lark.exceptions import LarkError, UnexpectedInput
from lark.lexer import Lexer

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "src"))

from hukum_bersih.pdf import structure as st
from hukum_bersih.pdf.extract import clean_lines, page_lines
from hukum_bersih.pdf.lines import Kind, normalise
from hukum_bersih.pdf.lines import classify as classify_line

# --------------------------------------------------------------------------- blocks

BLOCKS = r"""
start: front body closing? tail
front: (OPENING | PREAMBLE | ITEM | TEXT)*
body: (bab | pasal)+
bab: BAB TEXT* (bagian | pasal)*
bagian: BAGIAN TEXT? (paragraf | pasal)*
paragraf: PARAGRAF TEXT? pasal*
pasal: PASAL (AYAT | ITEM | TEXT | PLABEL)*
closing: CLOSING (CLOSING | TEXT | ITEM)*
tail: (penjelasan | lampiran)*
penjelasan: PENJELASAN (TEXT | ITEM | AYAT | PLABEL | UMUM | PDP | p_pasal | CLOSING)*
p_pasal: PASAL (TEXT | ITEM | AYAT | PLABEL)*
lampiran: LAMPIRAN (TEXT | ITEM | AYAT | PLABEL | PASAL | BAB | BAGIAN | PARAGRAF | CLOSING
                    | UMUM | PDP)*
%declare OPENING PREAMBLE ITEM TEXT BAB BAGIAN PARAGRAF PASAL AYAT PLABEL CLOSING PENJELASAN
%declare UMUM PDP LAMPIRAN
"""
# the grammar's token for a line: the first of these classes it matches (pdf/lines.py)
TOKENS = [
    ("PENJELASAN", Kind.PENJELASAN), ("LAMPIRAN", Kind.LAMPIRAN), ("CLOSING", Kind.CLOSING),
    ("PART", Kind.PENJELASAN_PART), ("BAB", Kind.BAB), ("BAGIAN", Kind.BAGIAN),
    ("PARAGRAF", Kind.PARAGRAF), ("PASAL", Kind.PASAL), ("AYAT", Kind.AYAT),
    ("PLABEL", Kind.PENJELASAN_LABEL), ("ITEM", Kind.LIST_ITEM),
]
PARTS = {"umum": "UMUM", "pasal_demi_pasal": "PDP"}     # a numeral alone is no token


def token(line) -> str:
    for name, kind in TOKENS:
        fields = line.get(kind)
        if fields is not None and (kind is not Kind.PENJELASAN_PART or fields[0]):
            return PARTS[fields[0]] if kind is Kind.PENJELASAN_PART else name
    return "TEXT"


def classify(lines: list[str]) -> list[str]:
    kinds, seen_pasal = [], False
    for line in map(classify_line, lines):
        kind = token(line)
        if kind == "TEXT" and not seen_pasal:
            kind = ("PREAMBLE" if Kind.PREAMBLE in line
                    else "OPENING" if Kind.OPENING in line else "TEXT")
        seen_pasal = seen_pasal or kind == "PASAL"
        kinds.append(kind)
    return kinds


class LineStream(Lexer):
    """The classified lines are the tokens; their value is the line number."""

    def __init__(self, lexer_conf):
        pass

    def lex(self, kinds):
        for i, kind in enumerate(kinds):
            yield Token(kind, str(i))


def blocks(laws: list[str]) -> None:
    from regress import pdf_for

    reg = yaml.safe_load((HERE.parent / "tests" / "regression.yaml").read_text())
    parser = Lark(BLOCKS, parser="lalr", lexer=LineStream)
    print(f"{'law':12} {'lines':>6} {'grammar':>8} {'pasal':>6} {'parser':>6} {'expected':>8}  error")
    for law in laws or list(reg):
        lines = normalise(clean_lines(page_lines(pdf_for(law, reg[law]), ocr=False)))
        kinds = classify(lines)
        current = st.parse_lines(lines).pasal_count
        try:
            found, ok, error = sum(1 for _ in parser.parse(kinds).find_data("pasal")), "ok", ""
        except LarkError as e:
            found, ok = "-", "FAIL"
            tok = getattr(e, "token", None)
            error = f"line {tok.value} {tok.type} {lines[int(tok.value)][:50]!r}" if tok else str(e)
        print(f"{law:12} {len(lines):>6} {ok:>8} {found!s:>6} {current:>6} "
              f"{reg[law]['pasal']:>8}  {error}")


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
    mode, args = sys.argv[1], sys.argv[2:]
    {"blocks": blocks, "refs": refs}[mode](args)
