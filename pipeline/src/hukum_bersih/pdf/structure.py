"""Cleaned lines of an Indonesian regulation or draft -> a flat list of structural blocks
(BAB, Bagian, Paragraf, Pasal, ayat, list items, Penjelasan), written out by ``akn/bluebell.py``.

Structure markers are only accepted in sequence (Pasal n+1 after Pasal n, ayat (k+1) after (k),
b after a, ...). That keeps cross-references that happen to start a wrapped line ("Pasal 5 ayat
(1) ...") from being mistaken for headings. What each line is on its own comes from the line
registry (``lines.py``); this module decides what it means given what came before.
"""

from __future__ import annotations

import re
from collections.abc import Sequence
from dataclasses import dataclass, field
from pathlib import Path

from .lines import Kind, Line, classify, normalise
from .ocr_fix import Fixes

PARSER_VERSION = 17  # 17: a heading after "… berbunyi sebagai berikut:" is the amended law's quoted pasal, never a skipped or misprinted number of the law's own (UU 7/2021 lost Pasal 5 and 8). 16: page header and footer of scanned pages removed by where the OCR put them, not by their (misread) text (pdf/edges.py). 15: misread words of scanned pages corrected when the spell check is confident (pdf/ocr_fix.py, decision 0013). 14: scanned pages read with Indra OCR instead of Tesseract (decision 0012; parser unchanged). 13: misprinted pasal numbers confirmed by the next heading ("Pasal 9" twice, UU 19/1948). 12: OCR letters for digits in heading numbers ("Pasal S1"), spaced marks ("Pasal 84 ,"); amending Penjelasan: Angka above Ayat (UU 11, 12, 13/2022). 11: OCR specks after a Pasal heading ("Pasal 4 :", UU 29/2024); parallel OCR (same words). 10: OCR speck before a Pasal heading ("' Pasal 8", UU 135/2024). 9: browser print headers/footers dropped; separate Penjelasan PDF read (UU 19/2003). 8: v7 dropped a Penjelasan after a copy certification (UU 2/2025): fixed;
#                    Penjelasan of amending laws (Pasal I/II), OCR '1. UMUM'.
#                   7: amending laws keep quoted articles in Pasal I, white (hidden)
#                    text dropped, salinan certification left out, MEMORI PENJELASAN;
#                   6: scanned pages read with our own OCR (Tesseract ind), page-turn words
#                    anywhere on a page;
#                   5: printed lines rebuilt from word positions, page-turn words, headings
#                    with a full stop ("Pasal 1."), old numbering, closing line by line;
#                   2: page headers/numbers on every page (Pasal.id rules); 3: old-spelling closings and
#                    PENDJELASAN; 4: lists between a BAB heading and its first Pasal (UU 19/2003)
# Texts made by a parser older than this are re-converted on the next import; newer ones only
# when the record is flagged (kept old text, parse error, no text). Raise it only for a fix
# that changes laws which pass every check (Dante, 2026-11-22: don't redo good work).
PARSER_REDO_BELOW = 10
# Same, for texts read with OCR (scanned pages) only: a fix that changes only scanned pages
# redoes the ~330 OCR'd laws without the ~1,600 typed ones. 16: page header/footer by
# position (2026-11-24: UU 100/2024 kept "RESIDEN REPUBlK INDONESIA" in its title).
OCR_REDO_BELOW = 16

ORDINAL = {"PERTAMA": 1, "KESATU": 1, "KEDUA": 2, "KETIGA": 3, "KEEMPAT": 4, "KELIMA": 5,
           "KEENAM": 6, "KETUJUH": 7, "KEDELAPAN": 8, "KESEMBILAN": 9, "KESEPULUH": 10}
SALINAN_MAX = 15  # lines of a copy's certification block ("Salinan sesuai dengan aslinya" …)
# the block a Penjelasan part line (Kind.PENJELASAN_PART) opens, and its text
PENJELASAN_PARTS = {"umum": "Umum", "pasal_demi_pasal": "Pasal demi Pasal"}


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
    ocr_fixes: Fixes | None = None      # misread words corrected / left as read (pdf/ocr_fix.py)

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


def is_heading(line: Line) -> bool:
    return Kind.PASAL in line or Kind.BAGIAN in line or Kind.PARAGRAF in line


def heading_number(label: str) -> int:
    return ORDINAL[label.upper()] if label.upper() in ORDINAL else roman(label.upper())


class Parser:
    def __init__(self, lines: list[str]):
        self.lines = [classify(text) for text in normalise(lines)]
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
            if Kind.BAB in nxt or is_heading(nxt):
                break
            if caps and not is_caps(nxt.text):
                # older laws: the title in normal capitals, over up to four short lines
                # ("Tentang Urusan Rumah-Tangga" / "dan Kewajiban-Kewajiban" …), then a heading
                if j == i + 1 and nxt.text[:1].isupper():
                    k = j
                    while (k < len(self.lines) and k - j < 4 and len(self.lines[k].text.split()) <= 12
                           and not self.lines[k].text.endswith(":") and not is_heading(self.lines[k])
                           and not re.match(r"^[IVXLC]+\.\s", self.lines[k].text)):
                        k += 1
                    if k < len(self.lines) and (is_heading(self.lines[k])
                                                or re.match(r"^[IVXLC]+\.\s", self.lines[k].text)):
                        parts.extend(ln.text for ln in self.lines[j:k])
                        j = k
                break
            parts.append(nxt.text)
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
        nxt = " ".join(ln.text for ln in self.lines[i + 1:i + 3])
        return "PERUBAHAN" in title and bool(re.match(
            r"^(Beberapa ketentuan|Ketentuan .{0,80}diubah|Undang-Undang Nomor .{0,200}diubah)", nxt))

    def next_heading(self, i: int) -> int | None:
        """Number of the next line that is a whole 'Pasal N' heading, within 400 lines."""
        for ln in self.lines[i + 1:i + 400]:
            if (pasal := ln.get(Kind.PASAL)) and not pasal[0][-1].isalpha():
                return int(pasal[0]) if pasal[0].isdigit() else roman(pasal[0])
            if Kind.PENJELASAN in ln or Kind.CLOSING in ln:
                return None
        return None

    def after_sentence(self, i: int) -> bool:
        """The line before ends a sentence or is a heading ("Cukup jelas" ends without a stop)."""
        prev = self.lines[i - 1].text.rstrip() if i else ""
        return (prev.endswith((".", ";", ":", ")")) or is_caps(prev) or Kind.PASAL in classify(prev)  # stripped
                or prev.lower().endswith("cukup jelas"))

    def quote_follows(self, i: int) -> bool:
        """The line before leads into quoted text ("… sehingga berbunyi sebagai berikut:"): the
        heading is the amended law's own, quoted in an amending law (UU 7/2021, Arabic pasal)."""
        return bool(i and re.search(r"berikut\s*:\s*$", self.lines[i - 1].text, re.IGNORECASE))

    def misprinted(self, i: int, n: int, last: int) -> bool:
        """A heading whose printed number breaks the sequence but the next heading continues it:
        a misprint in the copy ('Pasal 9' twice, UU 19/1948; 'Pasal 8' for 3, UU 29/1948; 'Pasal
        II' for 11, UU 1/1951), or a number the copy skips (the next is one more than this). It
        must follow the end of a sentence, so a cross-reference wrapped onto its own line is not
        taken."""
        if not self.after_sentence(i) or self.quote_follows(i):
            return False
        nxt = self.next_heading(i)
        return nxt == last + 2 or (last + 1 < n <= last + 3 and nxt == n + 1)

    def had_penjelasan(self) -> bool:
        return any(b.kind == "penjelasan" for b in self.doc.blocks)

    def title_follows(self, i: int) -> bool:
        nxt = self.lines[i + 1] if i + 1 < len(self.lines) else classify("")
        return is_caps(nxt.text) and Kind.PASAL not in nxt

    def step(self, line: Line, i: int) -> int:
        if self.in_salinan and (Kind.PENJELASAN in line or Kind.LAMPIRAN in line
                                or self.salinan_lines >= SALINAN_MAX):
            # the certification ends where the Penjelasan or a Lampiran starts; it is a few lines,
            # so a long skip means a misreading: stop and keep the text (UU 2/2025 lost its
            # Penjelasan to this before)
            if self.salinan_lines >= SALINAN_MAX:
                self.doc.warnings.append(f"salinan: no end found after {SALINAN_MAX} lines; text kept")
            self.in_salinan = False
        if not self.in_penjelasan and Kind.PENJELASAN in line and self.last_pasal:
            self.in_penjelasan = True
            umum = line.get(Kind.PENJELASAN_UMUM)
            self.emit(Block("penjelasan", text=umum[0] if umum else line.text))
            if umum:
                self.emit(Block("umum", text="Umum"))
            self.reset_lists()
            return 1
        if self.last_pasal and Kind.CLOSING in line:
            self.emit(Block("closing", text=line.text))
            return 1
        if self.in_salinan:
            self.salinan_lines += 1
            return 1
        if self.last_pasal and Kind.LAMPIRAN in line:
            # an annex (maps, tables, schedules) after the closing or the Penjelasan: kept as
            # printed lines in its own part; it ends at a Penjelasan or the next Lampiran
            self.in_lampiran = True
            self.emit(Block("lampiran", label=line.text))
            return 1
        # a Penjelasan heading ends a Lampiran only if the law's Penjelasan is still to come; after
        # it, the heading is part of the Lampiran (UU 13/2022's drafting guide quotes example
        # laws: "PENJELASAN ATAS UNDANG-UNDANG … NOMOR 7 TAHUN 2021")
        if self.in_lampiran and not (Kind.PENJELASAN in line and not self.had_penjelasan()):
            if Kind.SALINAN in line:
                self.in_salinan, self.salinan_lines = True, 0
                return 1
            self.emit(Block("lampiran_text", text=line.text))
            return 1
        if self.in_lampiran:
            self.in_lampiran = False
            self.in_penjelasan = False
        if self.last_pasal and Kind.SALINAN in line:
            # the copy's certification by the State Secretariat, often under a round stamp;
            # not part of the law (and OCR turns the stamp into noise)
            self.in_salinan, self.salinan_lines = True, 0
            self.doc.warnings.append("salinan: copy certified ('Salinan sesuai dengan aslinya'); left out")
            return 1
        if (self.cur is not None and self.cur.kind == "closing" and Kind.PENJELASAN not in line
                and line.text != "RANCANGAN"):
            if self.cur.text.startswith("Agar") and not self.cur.text.rstrip().endswith("."):
                self.cur.text = join(self.cur.text, line.text)  # the sentence goes on
            else:
                self.emit(Block("closing", text=line.text))     # signature blocks: as printed
            return 1
        if self.in_penjelasan:
            return self.step_penjelasan(line, i)

        pasal = line.get(Kind.PASAL)
        if self.amending and self.last_pasal == 1 and pasal == ("2",) and (
                not self.amends_so_far()         # "Pasal I." was a misprint for Pasal 1 (UU 16/1953)
                or (not self.quoted_one and i and self.lines[i - 1].text.rstrip().endswith("."))):
            # or the law's own Pasal 2 after amendments in Pasal I (UU 2/1953, 12/1957): it follows
            # a finished sentence, where a quoted pasal follows "… berbunyi sebagai berikut:"
            self.amending = False
        if self.amending and pasal == ("1",):
            self.quoted_one = True
        if self.amending and (Kind.BAB in line or Kind.BAGIAN in line or Kind.PARAGRAF in line
                              or (pasal and pasal[0][0].isdigit())):
            self.append(line.text)
            return 1
        if bab := line.get(Kind.BAB):
            n = heading_number(bab[0])
            if n == self.last_bab + 1 or (n == self.last_bab and self.title_follows(i)):
                self.last_bab = n + (n == self.last_bab)
                title, used = self.take_title(i, caps=True)
                self.emit(Block("bab", label=f"BAB {bab[0]}", text=title))
                return used
        if (bagian := line.get(Kind.BAGIAN)) and self.last_bab:
            title, used = self.take_title(i, caps=False)
            self.emit(Block("bagian", label=f"Bagian {bagian[0]}", text=title))
            return used
        if (paragraf := line.get(Kind.PARAGRAF)) and self.last_bab:
            title, used = self.take_title(i, caps=False)
            self.emit(Block("paragraf", label=f"Paragraf {paragraf[0]}", text=title))
            return used
        if pasal:
            num = pasal[0]
            if num == "1" and not self.last_pasal and self.reads_as_amending(i):
                num = "I"                                # OCR reads the Roman I of Pasal I as 1
                self.doc.warnings.append("'Pasal 1' read as 'Pasal I' (amending law, OCR)")
            n = int(re.match(r"\d+", num)[0]) if num[0].isdigit() else roman(num)
            # anything else is a cross-reference that happens to start a wrapped line, unless the
            # number is a misprint the following headings confirm (misprinted())
            if (n == self.last_pasal + 1 or (num[-1].isalpha() and n == self.last_pasal)
                    or (self.last_pasal and not self.amending and self.misprinted(i, n, self.last_pasal))):
                if n != self.last_pasal + 1 and not (num[-1].isalpha() and n == self.last_pasal):
                    n = self.last_pasal + 1 if self.next_heading(i) == self.last_pasal + 2 else n
                    self.doc.warnings.append(f"'Pasal {num}' printed where Pasal {n} belongs; kept as printed")
                if n == 1 and not num[0].isdigit() and not self.last_bab:
                    self.amending = True
                self.last_pasal = n
                self.emit(Block("pasal", label=f"Pasal {num}"))
                self.reset_lists()
                return 1
        if not self.last_pasal:
            return self.step_preamble(line)
        return self.step_list(line)

    def step_list(self, line: Line) -> int:
        if (ayat := line.get(Kind.AYAT)) and int(ayat[0]) == self.last_ayat + 1:
            self.last_ayat = int(ayat[0])
            self.lists = []
            self.emit(Block("ayat", label=f"({ayat[0]})", text=ayat[1]))
            return 1
        if (item := line.get(Kind.LIST_ITEM)) and (level := self.list_item(item[0], item[1])):
            self.emit(Block("item", label=f"{item[1]}.", text=item[2], level=level))
            return 1
        self.append(line.text)
        return 1

    def step_preamble(self, line: Line) -> int:
        if Kind.OPENING in line:
            self.emit(Block("preamble", text=line.text))
            return 1
        if preamble := line.get(Kind.PREAMBLE):
            label, rest = preamble
            self.emit(Block("preamble", label=label, text=rest))
            self.lists = []
            if (item := classify(rest).get(Kind.LIST_ITEM)) and self.list_item(item[0], item[1]):
                self.cur.text = ""
                self.emit(Block("item", label=f"{item[1]}.", text=item[2], level=1))
            return 1
        if self.cur is not None and self.cur.kind == "preamble" and line.text.startswith(":"):
            line = classify(line.text.lstrip(": ").strip())   # label alone, ": 1. …" on the next line
            if (not self.cur.text and (item := line.get(Kind.LIST_ITEM))
                    and self.list_item(item[0], item[1])):
                self.emit(Block("item", label=f"{item[1]}.", text=item[2], level=1))
                return 1
        if self.cur is None:
            if Kind.CREST_CAPTION in line:
                return 1
            self.emit(Block("title", text=line.text))
            return 1
        if self.cur.kind == "title":
            self.cur.text = join(self.cur.text, line.text)
            return 1
        # Menimbang / Mengingat lists are flat
        if (self.cur.kind in {"preamble", "item"} and (item := line.get(Kind.LIST_ITEM))
                and self.list_item(item[0], item[1]) == 1):
            self.emit(Block("item", label=f"{item[1]}.", text=item[2], level=1))
            return 1
        self.append(line.text)
        return 1

    def step_penjelasan(self, line: Line, i: int) -> int:
        if (part := line.get(Kind.PENJELASAN_PART)) and not self.p_last_pasal:
            if part[0]:                          # not the numeral alone before the part's name
                self.emit(Block(part[0], text=PENJELASAN_PARTS[part[0]]))
            return 1
        pasal = line.get(Kind.PASAL)
        if pasal and not pasal[0][0].isdigit() and self.amending:
            n = roman(pasal[0])                  # an amending law's Penjelasan: Pasal I, Pasal II
            if n == self.p_last_pasal + 1:
                self.p_last_pasal, self.p_roman = n, True
                self.emit(Block("p_pasal", label=f"Pasal {pasal[0]}"))
                return 1
        if pasal and not self.p_roman and (pasal[0][0].isdigit() or self.p_last_pasal):
            num = pasal[0]
            n = int(re.match(r"\d+", num)[0]) if num[0].isdigit() else roman(num)
            # a Penjelasan often explains only some pasal (old laws): any later pasal of the law
            # after the end of a sentence is a heading there (UU 2/1962: Pasal 5, then Pasal 12)
            skipped = self.p_last_pasal < n <= self.last_pasal and num[0].isdigit() and self.after_sentence(i)
            if (n == self.p_last_pasal + 1 or (num[-1].isalpha() and n == self.p_last_pasal) or skipped
                    or (self.p_last_pasal and self.misprinted(i, n, self.p_last_pasal))):
                if self.p_last_pasal and n != self.p_last_pasal + 1 and self.next_heading(i) == self.p_last_pasal + 2:
                    n = self.p_last_pasal + 1
                self.p_last_pasal = n
                self.emit(Block("p_pasal", label=f"Pasal {num}"))
                return 1
        if (label := line.get(Kind.PENJELASAN_LABEL)) and self.p_last_pasal:
            self.emit(Block("p_label", label=label[0], text=label[1]))
            return 1
        # Penjelasan umum is prose: start a new paragraph after a sentence end.
        if (self.cur and self.cur.kind == "text" and self.cur.text.endswith(".")
                and line.text[:1].isupper() and not self.p_last_pasal):
            self.emit(Block("text", text=line.text))
            return 1
        if self.cur and self.cur.kind in {"umum", "pasal_demi_pasal", "penjelasan"} and \
                self.cur.kind != "penjelasan":
            self.emit(Block("text", text=line.text))
            return 1
        self.append(line.text)
        return 1


def parse_lines(lines: list[str]) -> Document:
    return Parser(lines).run()


def parse_pdf(pdf: Path, extra: Sequence[Path] = (), stats: dict | None = None) -> Document:
    """``extra``: further PDFs of the same law read after it, such as a Penjelasan that BPK
    publishes as a separate file (UU 19/2003). ``stats``: filled by the page reading (OCR
    pages, the header/footer lines cut by position, ...) for a caller that wants to see them."""
    from .extract import clean_lines, page_lines

    stats = stats if stats is not None else {}
    lines = clean_lines(page_lines(pdf, stats), stats)
    for more in extra:
        lines += clean_lines(page_lines(more, stats), stats)
    doc = parse_lines(lines)
    if stats.get("ocr_pages"):
        doc.warnings.append(f"ocr: {stats['ocr_pages']} scanned page(s) read with {stats.get('ocr_engine', 'tesseract')}")
    if stats.get("edge_lines"):
        doc.warnings.append(f"edges: {len(stats['edge_lines'])} page header/footer line(s) of scanned pages removed by position")
    if parts := stats.get("ocr_fixes"):
        doc.ocr_fixes = fixes = Fixes(
            [c for f in parts for c in f.changed], [s for f in parts for s in f.suspects],
            "none" if any(f.checker == "none" for f in parts) else "hunspell")
        shown = ", ".join(f"{a}→{b}" for a, b in fixes.changed[:10])
        doc.warnings.append(f"ocr fixes: {len(fixes.changed)} misread word(s) corrected"
                            f"{f' ({shown})' if shown else ''}, {len(fixes.suspects)} unknown word(s) left as read"
                            + ("; Hunspell missing, nothing corrected" if fixes.checker == "none" else ""))
    if stats.get("ocr_fallback"):
        doc.warnings.append(f"ocr fallback, first engine failed: {stats['ocr_fallback']}")
    if stats.get("ocr_missing"):
        doc.warnings.append(f"ocr unavailable, used the PDF's own text layer: {stats['ocr_missing']}")
    return doc
