"""Structural blocks (pdf/structure.py) -> Bluebell text.

Bluebell (https://laws.africa/bluebell/, by Laws.Africa) is a plain-text markup that maps 1:1
to Akoma Ntoso, the OASIS standard for legal documents. We store Bluebell text in git because
it diffs cleanly, and generate Akoma Ntoso XML from it at build time (akn/build.py).

Indonesian structure -> Akoma Ntoso:

    BAB -> chapter          Pasal -> article        ayat (1) -> paragraph
    Bagian -> part          huruf a. / angka 1. -> point (nested by level)
    Paragraf -> subpart     Penjelasan -> attachment (Umum / Pasal demi Pasal as parts)
    Menimbang / Mengingat -> preamble     signature block -> conclusions
"""

from __future__ import annotations

import re

from ..pdf.structure import Block, Document

# Words that start a Bluebell block when they open a line; text that happens to start with one
# must be escaped.
KEYWORDS = {
    "ALINEA", "ANNEXURE", "APPENDIX", "ART", "ARTICLE", "ATTACHMENT", "BLOCKLIST", "BODY",
    "BOOK", "BULLETS", "CHAP", "CHAPTER", "CLAUSE", "CONCLUSIONS", "CROSSHEADING", "DIVISION",
    "FOOTNOTE", "INDENT", "ITEM", "ITEMS", "LEVEL", "LIST", "LONGTITLE", "PARA", "PARAGRAPH",
    "PART", "POINT", "PREAMBLE", "PREFACE", "PROVISO", "QUOTE", "RULE", "SCHEDULE", "SEC",
    "SECTION", "SUBCHAP", "SUBCHAPTER", "SUBCLAUSE", "SUBDIVISION", "SUBHEADING", "SUBLIST",
    "SUBPARA", "SUBPARAGRAPH", "SUBPART", "SUBRULE", "SUBSEC", "SUBSECTION", "SUBTITLE",
    "TABLE", "TC", "TH", "TITLE", "TOME", "TR", "TRANSITIONAL",
}
INDENT = "  "
RANK = {"Ayat": 0, "Huruf": 1, "Angka": 2}
# under an amending law's Pasal I, II …, 'Angka n' is the n-th change, above the ayat of the
# pasal it quotes (UU 13/2022: 'Angka 10' / 'Pasal 78' / 'Ayat (1)')
RANK_AMENDING = {"Angka": -1, "Ayat": 0, "Huruf": 1}


def escape(text: str) -> str:
    """Escape Bluebell inline markup (**bold**, //italics//, __underline__, {{...}}) and
    line-start keywords, leaving ordinary text such as 'dan/atau' untouched."""
    text = text.replace("\\", "\\\\")
    for pair in ("**", "//", "__", "{{"):
        text = text.replace(pair, "\\" + pair)
    first = text.split(" ", 1)[0]
    if first in KEYWORDS or first.startswith("*"):
        text = "\\" + text
    return text


def num(label: str) -> str:
    """Bluebell numbers end at whitespace-dash or end of line."""
    return label.replace(" - ", " \\- ")


class Writer:
    def __init__(self) -> None:
        self.out: list[str] = []

    def line(self, depth: int, text: str = "") -> None:
        self.out.append(f"{INDENT * depth}{text}".rstrip())

    def para(self, depth: int, text: str) -> None:
        if text:
            self.line(depth, escape(text))
            self.line(depth)

    def heading(self, depth: int, keyword: str, label: str, title: str = "") -> None:
        self.line(depth, f"{keyword} {num(label)} -{(' ' + escape(title)) if title else ''}")


def _strip(label: str, prefix: str) -> str:
    return label[len(prefix):].strip() if label.startswith(prefix) else label


def to_bluebell(doc: Document) -> str:
    w = Writer()
    # Lampiran (annexes) are written as attachments after everything else, wherever they stood
    blocks, lampiran = [], []
    for b in doc.blocks:
        if b.kind == "lampiran":
            lampiran.append([b])
        elif b.kind == "lampiran_text" and lampiran:
            lampiran[-1].append(b)
        else:
            blocks.append(b)
    body_start = next((k for k, b in enumerate(blocks)
                       if b.kind in {"bab", "pasal", "bagian", "paragraf"}), len(blocks))
    _front(w, blocks[:body_start])

    w.line(0, "BODY")
    depth = {"bab": 1, "bagian": 1, "paragraf": 1, "pasal": 1}
    level = 1      # depth of the current container's children
    pasal_depth = 1
    ayat_depth: int | None = None
    in_pasal = False     # a list or text between a heading and the first Pasal is plain text
    closing: list[Block] = []
    penjelasan: list[Block] = []
    for k, b in enumerate(blocks[body_start:], start=body_start):
        if b.kind == "penjelasan":
            penjelasan = blocks[k:]
            break
        if b.kind == "closing":
            closing.append(b)
            continue
        if b.kind == "bab":
            depth = {"bab": 1, "bagian": 2, "paragraf": 2, "pasal": 2}
            w.heading(1, "CHAPTER", _strip(b.label, "BAB"), b.text)
            w.line(0)
            in_pasal, ayat_depth, level = False, None, 2
        elif b.kind == "bagian":
            d = depth["bagian"]
            depth["paragraf"] = depth["pasal"] = d + 1
            w.heading(d, "PART", _strip(b.label, "Bagian"), b.text)
            w.line(0)
            in_pasal, ayat_depth, level = False, None, d + 1
        elif b.kind == "paragraf":
            d = depth["paragraf"]
            depth["pasal"] = d + 1
            w.heading(d, "SUBPART", _strip(b.label, "Paragraf"), b.text)
            w.line(0)
            in_pasal, ayat_depth, level = False, None, d + 1
        elif b.kind == "pasal":
            pasal_depth = depth["pasal"]
            w.heading(pasal_depth, "ART", _strip(b.label, "Pasal"))
            level, ayat_depth, in_pasal = pasal_depth + 1, None, True
        elif not in_pasal:
            w.para(level, f"{b.label} {b.text}".strip() if b.kind != "text" else b.text)
        elif b.kind == "ayat":
            ayat_depth = pasal_depth + 1
            w.line(ayat_depth, f"PARA {b.label}")
            w.para(ayat_depth + 1, b.text)
            level = ayat_depth + 1
        elif b.kind == "item":
            base = (ayat_depth + 1) if ayat_depth is not None else pasal_depth + 1
            d = base + b.level - 1
            w.line(d, f"POINT {b.label}")
            w.para(d + 1, b.text)
        elif b.kind == "text":
            w.para(level if ayat_depth is None else ayat_depth + 1, b.text)

    if closing:
        w.line(0, "CONCLUSIONS")
        for b in closing:
            w.para(1, re.sub(r"\s*RANCANGAN\W*$", "", b.text))
    if penjelasan:
        _penjelasan(w, penjelasan)
    for group in lampiran:
        w.line(0, f"ATTACHMENT {escape(group[0].label.title())}")
        w.line(1, f"PART - {escape(group[0].label)}")
        for b in group[1:]:
            w.para(2, b.text)
    return "\n".join(w.out).rstrip() + "\n"


def _front(w: Writer, blocks: list[Block]) -> None:
    title = [b for b in blocks if b.kind == "title"]
    if title:
        w.line(0, "PREFACE")
        for b in title:
            w.para(1, b.text)
    rest = [b for b in blocks if b.kind != "title"]
    if not rest:
        return
    w.line(0, "PREAMBLE")
    in_list = False
    for b in rest:
        if b.kind == "item":
            if not in_list:
                w.line(1, "BLOCKLIST")
                in_list = True
            w.line(2, f"ITEM {b.label}")
            w.para(3, b.text)
            continue
        in_list = False
        if b.kind == "preamble":
            w.para(1, f"{b.label}:{(' ' + b.text) if b.text else ''}" if b.label else b.text)
        else:
            w.para(1, b.text)


def _penjelasan(w: Writer, blocks: list[Block]) -> None:
    w.line(0, "ATTACHMENT Penjelasan")
    head = blocks[0]
    level, open_labels, ranks = 1, [], RANK
    if head.text:
        w.line(1, "PART - PENJELASAN")
        w.para(2, head.text)
    for b in blocks[1:]:
        if b.kind == "umum":
            w.line(1, "PART I - UMUM")
            level = 2
        elif b.kind == "pasal_demi_pasal":
            w.line(1, "PART II - PASAL DEMI PASAL")
            level = 2
        elif b.kind == "p_pasal":
            w.heading(2, "ART", _strip(b.label, "Pasal"))
            level, open_labels = 3, []
            ranks = RANK_AMENDING if re.fullmatch(r"[IVXLC]+", _strip(b.label, "Pasal").strip()) else RANK
        elif b.kind == "p_label":
            # 'Ayat (1)' > 'Huruf a' > 'Angka 3': explanation headings within a Pasal, nested
            # under the closest open heading of a higher rank.
            rank = ranks[b.label.split(" ", 1)[0]]
            while open_labels and open_labels[-1] >= rank:
                open_labels.pop()
            d = 3 + len(open_labels)
            open_labels.append(rank)
            w.line(d, f"PARA {num(b.label)}")
            w.para(d + 1, b.text)
            level = d + 1
        elif b.kind == "closing":
            w.para(1, b.text)
        else:
            w.para(level, b.text)
