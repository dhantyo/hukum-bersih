"""Cleaned lines of an Indonesian regulation or draft -> a flat list of structural blocks
(BAB, Bagian, Paragraf, Pasal, ayat, list items, Penjelasan), written out by ``akn/bluebell.py``.

Structure markers are only accepted in sequence (Pasal n+1 after Pasal n, ayat (k+1) after (k),
b after a, ...). That keeps cross-references that happen to start a wrapped line ("Pasal 5 ayat
(1) ...") from being mistaken for headings.
"""

from __future__ import annotations

import re
from collections.abc import Sequence
from dataclasses import dataclass, field
from pathlib import Path

PARSER_VERSION = 9  # 9: browser print headers/footers dropped; separate Penjelasan PDF read (UU 19/2003). 8: v7 dropped a Penjelasan after a copy certification (UU 2/2025): fixed;
#                    Penjelasan of amending laws (Pasal I/II), OCR '1. UMUM'.
#                   7: amending laws keep quoted articles in Pasal I, white (hidden)
#                    text dropped, salinan certification left out, MEMORI PENJELASAN;
#                   6: scanned pages read with our own OCR (Tesseract ind), page-turn words
#                    anywhere on a page;
#                   5: printed lines rebuilt from word positions, page-turn words, headings
#                    with a full stop ("Pasal 1."), old numbering, closing line by line;
#                   2: page headers/numbers on every page (Pasal.id rules); 3: old-spelling closings and
#                    PENDJELASAN; 4: lists between a BAB heading and its first Pasal (UU 19/2003)

ORDINAL = {"PERTAMA": 1, "KESATU": 1, "KEDUA": 2, "KETIGA": 3, "KEEMPAT": 4, "KELIMA": 5,
           "KEENAM": 6, "KETUJUH": 7, "KEDELAPAN": 8, "KESEMBILAN": 9, "KESEPULUH": 10}
BAB_RE = re.compile(r"^(?:BAB|Bab)\s+([IVXLC]+|Pertama|Kesatu|Ke(?:dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh))$")
BAGIAN_RE = re.compile(r"^(?:Bagian|BAGIAN)\s+(Ke\w+|KE\w+|Pertama|PERTAMA|[IVXLC]+)$")
PARAGRAF_RE = re.compile(r"^(?:Paragraf|PARAGRAF)\s+(\d+)$")
# Older laws end headings with a full stop: "Pasal 1.", "BAB I.", "BAGIAN II." (read without it)
HEAD_DOT_RE = re.compile(r"^((?:BAB|Bab|BAGIAN|Bagian|PARAGRAF|Paragraf|Pasal|PASAL)\s+\S+?)\s*\.$")
PASAL_RE = re.compile(r"^Pasal\s+(\d+[A-Z]?|[IVXLC]+)$")
AYAT_RE = re.compile(r"^\((\d+)\)\s*(.*)$")
LETTER_RE = re.compile(r"^([a-z])\.\s*(.*)$")
NUMBER_RE = re.compile(r"^(\d{1,3})\.\s*(.*)$")
PENJ_AYAT_RE = re.compile(r"^Ayat\s+\((\d+)\)\s*(.*)$")
PENJ_HURUF_RE = re.compile(r"^Huruf\s+([a-z])\s*(.*)$")
PENJ_ANGKA_RE = re.compile(r"^Angka\s+(\d+)\s*(.*)$")
PREAMBLE_RE = re.compile(
    r"^(Menimbang|Mengingat|Menetapkan|MEMUTUSKAN|Memutuskan|Dengan [Pp]ersetujuan(?: [Bb]ersama)?)\s*:?\s*(.*)$"
)
# "PENJELASAN", "PENJELASAN ATAS", old spelling "PENDJELASAN", optionally followed on the
# same line by the law's citation in capitals ("PENDJELASAN UNDANG-UNDANG 1945 NO. 1").
# "PENJELASAN ATAS UNDANG-UNDANG No. 6 TAHUN 1967" (the "No." is not in capitals)
PENJELASAN_RE = re.compile(r"^(?:RANCANGAN\s+|MEMORI\s+)?PEND?JELASAN\.?(?:\s+ATAS)?(?:\s+(?:[A-Z0-9 .,/()-]|No\.)+)?$")
# Closing formula and signatures, including old-spelling (Ejaan Lama) laws:
# "Djakarta, tanggal 23 Nopember 1945", "Diumumkan pada tanggal ...", "Dikeluarkan di ...".
CLOSING_RE = re.compile(
    r"^(Agar (?:supaya )?setiap orang (?:dapat )?mengetahui(?:nja|nya)|Disahka[nh] di|Disjahkan di|"
    r"Diundangkan di|Diundangkan pada|Diumumkan|Ditetapkan di|Dikeluarkan di|"
    r"D[j]?akarta,? (?:pada )?tanggal|"
    r"LEMBARAN NEGARA REPUBLIK INDONESIA TAHUN|TAMBAHAN LEMBARAN NEGARA)"
)
SALINAN_MAX = 15  # lines of a copy's certification block ("Salinan sesuai dengan aslinya" …)
LAMPIRAN_RE = re.compile(r"^LAMPIRAN(?:\s+[IVXLC]+)?$")
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
    def amending(self) -> bool:
        """An amending law: its own articles are Pasal I, II … (the quoted new wording sits
        inside Pasal I)."""
        first = next((b.label for b in self.blocks if b.kind == "pasal"), "")
        return bool(re.search(r"\b[IVX]+\s*\.?$", first))

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


def normalise(lines: list[str]) -> list[str]:
    """Read headings the same whatever their printing: drop a heading's full stop and join
    "Pasal" printed on its own line with the number below it. Only heading lines change."""
    out: list[str] = []
    for line in lines:
        if out and out[-1] in ("Pasal", "PASAL") and re.match(r"^\d+[A-Z]?\.?$", line):
            out[-1] = f"Pasal {line.rstrip('.')}"
            continue
        if m := HEAD_DOT_RE.match(line):
            line = m[1]
        if m := re.match(r"^(?:PASAL|Pasal)\s*(\d+[A-Z]?|[IVXLC]+)$", line):   # OCR: "PasalI"
            line = f"Pasal {m[1]}"
        out.append(line)
    return out


def is_heading(line: str) -> bool:
    return bool(PASAL_RE.match(line) or BAGIAN_RE.match(line) or PARAGRAF_RE.match(line))


def heading_number(label: str) -> int:
    return ORDINAL[label.upper()] if label.upper() in ORDINAL else roman(label.upper())


class Parser:
    def __init__(self, lines: list[str]):
        self.lines = normalise(lines)
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
        # An amending law's own articles are Pasal I, II …; inside Pasal I it quotes the new
        # wording of the amended law ("Pasal 4", "BAB IVA" …), which is content, not structure.
        self.amending = False
        self.in_salinan = False
        self.in_lampiran = False
        self.quoted_one = False
        self.salinan_lines = 0
        self.p_roman = False

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
                # older laws: the title in normal capitals, over up to four short lines
                # ("Tentang Urusan Rumah-Tangga" / "dan Kewajiban-Kewajiban" …), then a heading
                if j == i + 1 and nxt[:1].isupper():
                    k = j
                    while (k < len(self.lines) and k - j < 4 and len(self.lines[k].split()) <= 12
                           and not self.lines[k].endswith(":") and not is_heading(self.lines[k])
                           and not re.match(r"^[IVXLC]+\.\s", self.lines[k])):
                        k += 1
                    if k < len(self.lines) and (is_heading(self.lines[k])
                                                or re.match(r"^[IVXLC]+\.\s", self.lines[k])):
                        parts.extend(self.lines[j:k])
                        j = k
                break
            parts.append(nxt)
            j += 1
            if not caps:
                break
        return " ".join(parts), j - i

    def amends_so_far(self) -> bool:
        """Pasal I so far contains amendment wording."""
        k = max(i for i, b in enumerate(self.doc.blocks) if b.kind == "pasal")
        text = " ".join(b.text for b in self.doc.blocks[k:])
        return bool(re.search(r"diubah|disisipkan|dihapus|ditambah|sebagai berikut|berbunyi", text))

    def reads_as_amending(self, i: int) -> bool:
        title = " ".join(b.text for b in self.doc.blocks if b.kind == "title").upper()
        nxt = " ".join(self.lines[i + 1:i + 3])
        return "PERUBAHAN" in title and bool(re.match(
            r"^(Beberapa ketentuan|Ketentuan .{0,80}diubah|Undang-Undang Nomor .{0,200}diubah)", nxt))

    def title_follows(self, i: int) -> bool:
        nxt = self.lines[i + 1] if i + 1 < len(self.lines) else ""
        return bool(nxt) and is_caps(nxt) and not PASAL_RE.match(nxt)

    def step(self, line: str, i: int) -> int:
        if self.in_salinan and (PENJELASAN_RE.match(line) or LAMPIRAN_RE.match(line)
                                or self.salinan_lines >= SALINAN_MAX):
            # the certification ends where the Penjelasan or a Lampiran starts; it is a few lines,
            # so a long skip means a misreading: stop and keep the text (UU 2/2025 lost its
            # Penjelasan to this before)
            if self.salinan_lines >= SALINAN_MAX:
                self.doc.warnings.append(f"salinan: no end found after {SALINAN_MAX} lines; text kept")
            self.in_salinan = False
        if not self.in_penjelasan and PENJELASAN_RE.match(line) and self.last_pasal:
            self.in_penjelasan = True
            umum = re.match(r"^(PEND?JELASAN)\s+UMUM\.?$", line)
            self.emit(Block("penjelasan", text=umum[1] if umum else line))
            if umum:
                self.emit(Block("umum", text="Umum"))
            self.reset_lists()
            return 1
        if self.last_pasal and (m := CLOSING_RE.match(line)):
            self.emit(Block("closing", text=line))
            return 1
        if self.in_salinan:
            self.salinan_lines += 1
            return 1
        if self.last_pasal and LAMPIRAN_RE.match(line):
            # an annex (maps, tables, schedules) after the closing or the Penjelasan: kept as
            # printed lines in its own part; it ends at a Penjelasan or the next Lampiran
            self.in_lampiran = True
            self.emit(Block("lampiran", label=line))
            return 1
        if self.in_lampiran and not PENJELASAN_RE.match(line):
            if re.match(r"^Salinan sesuai dengan aslinya", line, re.IGNORECASE):
                self.in_salinan, self.salinan_lines = True, 0
                return 1
            self.emit(Block("lampiran_text", text=line))
            return 1
        if self.in_lampiran:
            self.in_lampiran = False
            self.in_penjelasan = False
        if self.last_pasal and re.match(r"^Salinan sesuai dengan aslinya", line, re.IGNORECASE):
            # the copy's certification by the State Secretariat, often under a round stamp;
            # not part of the law (and OCR turns the stamp into noise)
            self.in_salinan, self.salinan_lines = True, 0
            self.doc.warnings.append("salinan: copy certified ('Salinan sesuai dengan aslinya'); left out")
            return 1
        if (self.cur is not None and self.cur.kind == "closing" and not PENJELASAN_RE.match(line)
                and line != "RANCANGAN"):
            if self.cur.text.startswith("Agar") and not self.cur.text.rstrip().endswith("."):
                self.cur.text = join(self.cur.text, line)       # the sentence goes on
            else:
                self.emit(Block("closing", text=line))          # signature blocks: as printed
            return 1
        if self.in_penjelasan:
            return self.step_penjelasan(line)

        if self.amending and self.last_pasal == 1 and (m := PASAL_RE.match(line)) and m[1] == "2" and (
                not self.amends_so_far()         # "Pasal I." was a misprint for Pasal 1 (UU 16/1953)
                or (not self.quoted_one and i and self.lines[i - 1].rstrip().endswith("."))):
            # or the law's own Pasal 2 after amendments in Pasal I (UU 2/1953, 12/1957): it follows
            # a finished sentence, where a quoted pasal follows "… berbunyi sebagai berikut:"
            self.amending = False
        if self.amending and (m := PASAL_RE.match(line)) and m[1] == "1":
            self.quoted_one = True
        if self.amending and (BAB_RE.match(line) or BAGIAN_RE.match(line) or PARAGRAF_RE.match(line)
                              or (PASAL_RE.match(line) and PASAL_RE.match(line)[1][0].isdigit())):
            self.append(line)
            return 1
        if m := BAB_RE.match(line):
            n = heading_number(m[1])
            if n == self.last_bab + 1 or (n == self.last_bab and self.title_follows(i)):
                self.last_bab = n + (n == self.last_bab)
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
            if num == "1" and not self.last_pasal and self.reads_as_amending(i):
                num = "I"                                # OCR reads the Roman I of Pasal I as 1
                self.doc.warnings.append("'Pasal 1' read as 'Pasal I' (amending law, OCR)")
            n = int(re.match(r"\d+", num)[0]) if num[0].isdigit() else roman(num)
            # anything else is a cross-reference that happens to start a wrapped line
            if n == self.last_pasal + 1 or (num[-1].isalpha() and n == self.last_pasal):
                if n == 1 and not num[0].isdigit() and not self.last_bab:
                    self.amending = True
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
            for kind, rx in (("letter", LETTER_RE), ("number", NUMBER_RE)):
                if (lm := rx.match(m[2])) and self.list_item(kind, lm[1]):
                    self.cur.text = ""
                    self.emit(Block("item", label=f"{lm[1]}.", text=lm[2], level=1))
                    break
            return 1
        if self.cur is not None and self.cur.kind == "preamble" and line.startswith(":"):
            line = line.lstrip(": ").strip()             # label alone, ": 1. …" on the next line
            if not self.cur.text:
                for kind, rx in (("letter", LETTER_RE), ("number", NUMBER_RE)):
                    if (lm := rx.match(line)) and self.list_item(kind, lm[1]):
                        self.emit(Block("item", label=f"{lm[1]}.", text=lm[2], level=1))
                        return 1
        if self.cur is None:
            if line.upper() in {"PRESIDEN", "REPUBLIK INDONESIA", "PRESIDEN REPUBLIK INDONESIA", "SALINAN"}:
                return 1                                 # caption under the crest, not the title
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
        if re.match(r"^(?:[I1l]\.\s*|A\.\s*)?(?:PEND?JELASAN\s+)?UMUM\.?$", line) and not self.p_last_pasal:
            self.emit(Block("umum", text="Umum"))
            return 1
        if re.match(r"^(?:II\.\s*|B\.\s*)?(?:PEND?JELASAN\s+)?PASAL DEMI PASAL\.?$", line) and not self.p_last_pasal:
            self.emit(Block("pasal_demi_pasal", text="Pasal demi Pasal"))
            return 1
        if (m := PASAL_RE.match(line)) and not m[1][0].isdigit() and self.amending:
            n = roman(m[1])                      # an amending law's Penjelasan: Pasal I, Pasal II
            if n == self.p_last_pasal + 1:
                self.p_last_pasal, self.p_roman = n, True
                self.emit(Block("p_pasal", label=f"Pasal {m[1]}"))
                return 1
        if (m := PASAL_RE.match(line)) and m[1][0].isdigit() and not self.p_roman:
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


def parse_pdf(pdf: Path, extra: Sequence[Path] = ()) -> Document:
    """``extra``: further PDFs of the same law read after it, such as a Penjelasan that BPK
    publishes as a separate file (UU 19/2003)."""
    from .extract import clean_lines, page_lines

    stats: dict = {}
    lines = clean_lines(page_lines(pdf, stats))
    for more in extra:
        lines += clean_lines(page_lines(more, stats))
    doc = parse_lines(lines)
    if stats.get("ocr_pages"):
        doc.warnings.append(f"ocr: {stats['ocr_pages']} scanned page(s) read with Tesseract")
    if stats.get("ocr_missing"):
        doc.warnings.append(f"ocr unavailable, used the PDF's own text layer: {stats['ocr_missing']}")
    return doc
