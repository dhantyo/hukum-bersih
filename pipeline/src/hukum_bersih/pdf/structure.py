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

PARSER_VERSION = 4  # 2: page headers/numbers on every page (Pasal.id rules); 3: old-spelling closings and
#                    PENDJELASAN; 4: lists between a BAB heading and its first Pasal (UU 19/2003)

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
# "PENJELASAN", "PENJELASAN ATAS", old spelling "PENDJELASAN", optionally followed on the
# same line by the law's citation in capitals ("PENDJELASAN UNDANG-UNDANG 1945 NO. 1").
PENJELASAN_RE = re.compile(r"^(?:RANCANGAN\s+)?PEND?JELASAN(?:\s+ATAS)?(?:\s+[A-Z0-9 .,/()-]+)?$")
# Closing formula and signatures, including old-spelling (Ejaan Lama) laws:
# "Djakarta, tanggal 23 Nopember 1945", "Diumumkan pada tanggal ...", "Dikeluarkan di ...".
CLOSING_RE = re.compile(
    r"^(Agar setiap orang mengetahuinja|Agar setiap orang mengetahuinya|Disahkan di|Disjahkan di|"
    r"Diundangkan di|Diundangkan pada|Diumumkan|Ditetapkan di|Dikeluarkan di|"
    r"D[j]?akarta,? (?:pada )?tanggal|"
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


def _follows(last: str, marker: str, kind: str) -> bool:
    if kind == "letter":
        return len(marker) == 1 and ord(marker) == ord(last) + 1
    return int(marker) == int(last) + 1


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
        # Open lists inside the current ayat/pasal, outermost first: [kind, last marker].
        # Letters inside a numbered item (or numbers inside a lettered item) nest one deeper.
        self.lists: list[list] = []
        self.in_penjelasan = False
        self.p_last_pasal = 0

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
        self.lists = []

    def list_item(self, kind: str, marker: str) -> int | None:
        """Nesting level (1 = outermost) if ``marker`` can start or continue a list here, else
        None. ``kind`` is "letter" (a., b., ...) or "number" (1., 2., ...)."""
        first = "a" if kind == "letter" else "1"
        for depth in range(len(self.lists) - 1, -1, -1):     # continue an open list
            open_kind, last = self.lists[depth]
            if open_kind == kind and _follows(last, marker, kind):
                del self.lists[depth + 1:]
                self.lists[depth][1] = marker
                return depth + 1
        if marker != first:
            return None
        if self.lists and self.lists[-1][0] != kind:         # nested list under an item
            self.lists.append([kind, marker])
        else:                                                # new list at the top
            self.lists = [[kind, marker]]
        return len(self.lists)

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
            # anything else is a cross-reference that happens to start a wrapped line
            if n == self.last_pasal + 1 or (num[-1].isalpha() and n == self.last_pasal):
                self.last_pasal = n
                self.emit(Block("pasal", label=f"Pasal {num}"))
                self.reset_lists()
                return 1
        if not self.last_pasal:
            return self.step_preamble(line)
        return self.step_list(line)

    def step_list(self, line: str) -> int:
        if (m := AYAT_RE.match(line)) and int(m[1]) == self.last_ayat + 1:
            self.last_ayat = int(m[1])
            self.lists = []
            self.emit(Block("ayat", label=f"({m[1]})", text=m[2]))
            return 1
        for kind, rx in (("letter", LETTER_RE), ("number", NUMBER_RE)):
            if (m := rx.match(line)) and (level := self.list_item(kind, m[1])):
                self.emit(Block("item", label=f"{m[1]}.", text=m[2], level=level))
                return 1
        self.append(line)
        return 1

    def step_preamble(self, line: str) -> int:
        if OPENING_RE.match(line):
            self.emit(Block("preamble", text=line))
            return 1
        if m := PREAMBLE_RE.match(line):
            self.emit(Block("preamble", label=m[1], text=m[2]))
            self.lists = []
            if (lm := LETTER_RE.match(m[2])) and self.list_item("letter", lm[1]):
                self.cur.text = ""
                self.emit(Block("item", label=f"{lm[1]}.", text=lm[2], level=1))
            return 1
        if self.cur is None:
            self.emit(Block("title", text=line))
            return 1
        if self.cur.kind == "title":
            self.cur.text = join(self.cur.text, line)
            return 1
        if self.cur.kind in {"preamble", "item"}:
            # Menimbang / Mengingat lists are flat
            for kind, rx in (("letter", LETTER_RE), ("number", NUMBER_RE)):
                if (m := rx.match(line)) and self.list_item(kind, m[1]) == 1:
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
