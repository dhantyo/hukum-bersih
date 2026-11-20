"""Cleaned lines of an Indonesian regulation or draft -> a flat list of structural blocks
(BAB, Bagian, Paragraf, Pasal, ayat, list items, Penjelasan), written out by ``akn/bluebell.py``.

Structure markers are only accepted in sequence (Pasal n+1 after Pasal n, ayat (k+1) after (k),
b after a, ...). That keeps cross-references that happen to start a wrapped line ("Pasal 5 ayat
(1) ...") from being mistaken for headings.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

PARSER_VERSION = 1

BAB_RE = re.compile(r"^BAB\s+([IVXLC]+)$")
BAGIAN_RE = re.compile(r"^Bagian\s+(Ke\w+)$")
PARAGRAF_RE = re.compile(r"^Paragraf\s+(\d+)$")
PASAL_RE = re.compile(r"^Pasal\s+(\d+[A-Z]?|[IVXLC]+)$")
AYAT_RE = re.compile(r"^\((\d+)\)\s*(.*)$")
LETTER_RE = re.compile(r"^([a-z])\.\s*(.*)$")
NUMBER_RE = re.compile(r"^(\d{1,3})\.\s*(.*)$")
PENJ_AYAT_RE = re.compile(r"^Ayat\s+\((\d+)\)\s*(.*)$")
PENJ_HURUF_RE = re.compile(r"^Huruf\s+([a-z])\s*(.*)$")
PENJ_ANGKA_RE = re.compile(r"^Angka\s+(\d+)\s*(.*)$")
PREAMBLE_RE = re.compile(
    r"^(Menimbang|Mengingat|Menetapkan|MEMUTUSKAN|Dengan Persetujuan Bersama)\s*:?\s*(.*)$"
)
PENJELASAN_RE = re.compile(r"^(?:RANCANGAN\s+)?PENJELASAN(?:\s+ATAS)?$")
CLOSING_RE = re.compile(
    r"^(Agar setiap orang mengetahuinya|Disahkan di|Diundangkan di|"
    r"LEMBARAN NEGARA REPUBLIK INDONESIA TAHUN|TAMBAHAN LEMBARAN NEGARA)"
)
OPENING_RE = re.compile(r"^(DENGAN RAHMAT TUHAN YANG MAHA ESA|PRESIDEN REPUBLIK INDONESIA,?)$")


@dataclass
class Block:
    kind: str           # title, preamble, bab, bagian, paragraf, pasal, ayat, item, text,
    #                     penjelasan, umum, pasal_demi_pasal, p_pasal, p_label
    label: str = ""
    text: str = ""
    level: int = 0      # list nesting for items


@dataclass
class Document:
    blocks: list[Block] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def pasal_count(self) -> int:
        return sum(1 for b in self.blocks if b.kind == "pasal")

    @property
    def bab_count(self) -> int:
        return sum(1 for b in self.blocks if b.kind == "bab")


def join(a: str, b: str) -> str:
    if not a:
        return b
    if not b:
        return a
    if re.search(r"[A-Za-z]-$", a):           # Undang-\nUndang
        return a + b
    return f"{a} {b}"


def tidy(text: str) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"(\w)- (\w)", r"\1-\2", text)   # "Undang- Undang" from justified layout
    text = re.sub(r"\s+([,;:.)])", r"\1", text)
    text = re.sub(r"\(\s+", "(", text)
    text = re.sub(r"([“‘])\s+", r"\1", text)
    text = re.sub(r"\s+([”’])", r"\1", text)
    text = re.sub(r"^:\s*", "", text)
    return text


def roman(s: str) -> int:
    vals = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100}
    total = 0
    for i, ch in enumerate(s):
        v = vals[ch]
        total += -v if i + 1 < len(s) and vals[s[i + 1]] > v else v
    return total


def is_caps(line: str) -> bool:
    letters = [c for c in line if c.isalpha()]
    return bool(letters) and all(c.isupper() for c in letters)


# --------------------------------------------------------------------------- structure


class Parser:
    def __init__(self, lines: list[str]):
        self.lines = lines
        self.doc = Document()
        self.cur: Block | None = None
        self.last_pasal = 0
        self.last_bab = 0
        self.last_ayat = 0
        self.last_letter: str | None = None
        self.last_number = 0
        self.in_penjelasan = False
        self.p_last_pasal = 0
        self.expect_title_for: Block | None = None

    # helpers --------------------------------------------------------------
    def emit(self, block: Block) -> Block:
        self.doc.blocks.append(block)
        self.cur = block
        return block

    def append(self, line: str) -> None:
        if self.cur is None or self.cur.kind in {"bab", "bagian", "paragraf", "pasal", "p_pasal"}:
            self.emit(Block("text", text=line))
        else:
            self.cur.text = join(self.cur.text, line)

    def reset_lists(self) -> None:
        self.last_ayat = 0
        self.last_letter = None
        self.last_number = 0

    def item_level(self, kind: str) -> int:
        # numbers inside letters are nested; letters inside numbers are nested
        if kind == "letter":
            return 2 if self.last_number and self.last_letter is None and self._number_open else 1
        return 2 if self.last_letter is not None else 1

    _number_open = False

    # main -----------------------------------------------------------------
    def run(self) -> Document:
        i = 0
        while i < len(self.lines):
            line = self.lines[i]
            i += self.step(line, i)
        for b in self.doc.blocks:
            b.text = tidy(b.text)
            b.label = tidy(b.label)
        return self.doc

    def take_title(self, i: int, caps: bool) -> tuple[str, int]:
        """Heading titles follow on the next line(s)."""
        parts, j = [], i + 1
        while j < len(self.lines):
            nxt = self.lines[j]
            if (BAB_RE.match(nxt) or BAGIAN_RE.match(nxt) or PARAGRAF_RE.match(nxt)
                    or PASAL_RE.match(nxt)):
                break
            if caps and not is_caps(nxt):
                break
            parts.append(nxt)
            j += 1
            if not caps:
                break
        return " ".join(parts), j - i

    def step(self, line: str, i: int) -> int:
        if not self.in_penjelasan and PENJELASAN_RE.match(line) and self.last_pasal:
            self.in_penjelasan = True
            self.emit(Block("penjelasan", text=line))
            self.reset_lists()
            return 1
        if self.last_pasal and (m := CLOSING_RE.match(line)):
            self.emit(Block("closing", text=line))
            return 1
        if (self.cur is not None and self.cur.kind == "closing" and not PENJELASAN_RE.match(line)
                and line != "RANCANGAN"):
            self.cur.text = join(self.cur.text, line)
            return 1
        if self.in_penjelasan:
            return self.step_penjelasan(line)

        if m := BAB_RE.match(line):
            n = roman(m[1])
            if n == self.last_bab + 1:
                self.last_bab = n
                title, used = self.take_title(i, caps=True)
                self.emit(Block("bab", label=f"BAB {m[1]}", text=title))
                return used
        if (m := BAGIAN_RE.match(line)) and self.last_bab:
            title, used = self.take_title(i, caps=False)
            self.emit(Block("bagian", label=f"Bagian {m[1]}", text=title))
            return used
        if (m := PARAGRAF_RE.match(line)) and self.last_bab:
            title, used = self.take_title(i, caps=False)
            self.emit(Block("paragraf", label=f"Paragraf {m[1]}", text=title))
            return used
        if m := PASAL_RE.match(line):
            num = m[1]
            n = int(re.match(r"\d+", num)[0]) if num[0].isdigit() else roman(num)
            if n == self.last_pasal + 1 or (num[-1].isalpha() and n == self.last_pasal):
                if n == self.last_pasal + 1 and n != 1 and self.last_pasal == 0:
                    pass
                self.last_pasal = n
                self.emit(Block("pasal", label=f"Pasal {num}"))
                self.reset_lists()
                return 1
            if self.last_pasal and n != self.last_pasal + 1:
                pass  # a cross-reference that starts a wrapped line
        if not self.last_pasal:
            return self.step_preamble(line)
        return self.step_list(line)

    def step_list(self, line: str) -> int:
        if (m := AYAT_RE.match(line)) and int(m[1]) == self.last_ayat + 1:
            self.last_ayat = int(m[1])
            self.last_letter, self.last_number, self._number_open = None, 0, False
            self.emit(Block("ayat", label=f"({m[1]})", text=m[2]))
            return 1
        if m := LETTER_RE.match(line):
            ch = m[1]
            if ch == "a" or (self.last_letter and ord(ch) == ord(self.last_letter) + 1):
                level = 2 if (self._number_open and ch == "a") or (
                    self.cur and self.cur.kind == "item" and self.cur.level == 2
                    and self.last_letter is not None and ch != "a" and self._letters_nested
                ) else 1
                if ch == "a":
                    self._letters_nested = level == 2
                else:
                    level = 2 if self._letters_nested else 1
                self.last_letter = ch
                self.emit(Block("item", label=f"{ch}.", text=m[2], level=level))
                return 1
        if m := NUMBER_RE.match(line):
            k = int(m[1])
            if k == 1 or k == self.last_number + 1:
                if k == 1:
                    self._numbers_nested = self.last_letter is not None
                    self._number_open = True
                self.last_number = k
                level = 2 if self._numbers_nested else 1
                self.emit(Block("item", label=f"{k}.", text=m[2], level=level))
                return 1
        self.append(line)
        return 1

    _letters_nested = False
    _numbers_nested = False

    def step_preamble(self, line: str) -> int:
        if OPENING_RE.match(line):
            self.emit(Block("preamble", text=line))
            return 1
        if m := PREAMBLE_RE.match(line):
            self.emit(Block("preamble", label=m[1], text=m[2]))
            self.last_letter, self.last_number = None, 0
            rest = m[2]
            if lm := LETTER_RE.match(rest):
                self.cur.text = ""
                self.last_letter = lm[1]
                self.emit(Block("item", label=f"{lm[1]}.", text=lm[2], level=1))
            return 1
        if self.cur is None or (self.cur.kind == "title"):
            if self.cur is None:
                self.emit(Block("title", text=line))
            else:
                self.cur.text = join(self.cur.text, line)
            return 1
        if self.cur.kind in {"preamble", "item"}:
            if (m := LETTER_RE.match(line)) and (
                m[1] == "a" or (self.last_letter and ord(m[1]) == ord(self.last_letter) + 1)
            ):
                self.last_letter = m[1]
                self.emit(Block("item", label=f"{m[1]}.", text=m[2], level=1))
                return 1
            if (m := NUMBER_RE.match(line)) and int(m[1]) in (1, self.last_number + 1):
                self.last_number = int(m[1])
                self.emit(Block("item", label=f"{m[1]}.", text=m[2], level=1))
                return 1
        self.append(line)
        return 1

    def step_penjelasan(self, line: str) -> int:
        # "I. UMUM" / "II. PASAL DEMI PASAL", with the numeral sometimes on its own line
        if re.match(r"^(?:I|II)\.$", line) and not self.p_last_pasal:
            return 1
        if re.match(r"^(?:I\.\s*)?UMUM$", line) and not self.p_last_pasal:
            self.emit(Block("umum", text="Umum"))
            return 1
        if re.match(r"^(?:II\.\s*)?PASAL DEMI PASAL$", line) and not self.p_last_pasal:
            self.emit(Block("pasal_demi_pasal", text="Pasal demi Pasal"))
            return 1
        if (m := PASAL_RE.match(line)) and m[1][0].isdigit():
            n = int(re.match(r"\d+", m[1])[0])
            if n == self.p_last_pasal + 1 or (m[1][-1].isalpha() and n == self.p_last_pasal):
                self.p_last_pasal = n
                self.emit(Block("p_pasal", label=f"Pasal {m[1]}"))
                return 1
        for rx, fmt in ((PENJ_AYAT_RE, "Ayat ({})"), (PENJ_HURUF_RE, "Huruf {}"),
                        (PENJ_ANGKA_RE, "Angka {}")):
            if (m := rx.match(line)) and self.p_last_pasal:
                self.emit(Block("p_label", label=fmt.format(m[1]), text=m[2]))
                return 1
        # Penjelasan umum is prose: start a new paragraph after a sentence end.
        if (self.cur and self.cur.kind == "text" and self.cur.text.endswith(".")
                and line[:1].isupper() and not self.p_last_pasal):
            self.emit(Block("text", text=line))
            return 1
        if self.cur and self.cur.kind in {"umum", "pasal_demi_pasal", "penjelasan"} and \
                self.cur.kind != "penjelasan":
            self.emit(Block("text", text=line))
            return 1
        self.append(line)
        return 1


def parse_lines(lines: list[str]) -> Document:
    return Parser(lines).run()


def parse_pdf(pdf: Path) -> Document:
    from .extract import clean_lines, page_lines

    return parse_lines(clean_lines(page_lines(pdf)))
