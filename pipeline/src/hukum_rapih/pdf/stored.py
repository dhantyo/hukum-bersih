"""A stored Bluebell text (data/) turned back into printed lines, for the parser to read again:
headings as printed (``BAB I`` and its title, ``Pasal 1``), markers in front of their text
(``(1) ...``, ``a. ...``), Penjelasan parts as ``I. UMUM``. Close to the cleaned lines of the
law, not equal to them. Read by ``hukum-rapih explain`` and ``scripts/parser_identity.py``.
"""

from __future__ import annotations

import re

SECTIONS = {"PREFACE", "PREAMBLE", "BODY", "CONCLUSIONS", "BLOCKLIST"}
HEADINGS = {"CHAPTER": "BAB", "PART": "Bagian", "SUBPART": "Paragraf", "ART": "Pasal"}
HEADING_RE = re.compile(r"^(CHAPTER|PART|SUBPART|ART) (\S+) -(?: (.*))?$")
MARKER_RE = re.compile(r"^(?:PARA|POINT|ITEM) (.+)$")
PENJELASAN_PART = {"PART I - UMUM": "I. UMUM", "PART II - PASAL DEMI PASAL": "II. PASAL DEMI PASAL"}


def printed_lines(text: str) -> list[str]:
    out, marker = [], ""
    for raw in text.splitlines():
        line = raw.strip().removeprefix("\\")
        if not line or line in SECTIONS or line.startswith("ATTACHMENT "):
            continue
        if line in PENJELASAN_PART:
            out.append(PENJELASAN_PART[line])
        elif line.startswith("PART - "):
            out.append(line.removeprefix("PART - "))
        elif m := HEADING_RE.match(line):
            out.append(f"{HEADINGS[m[1]]} {m[2]}")
            if m[3]:
                out.append(m[3])
        elif m := MARKER_RE.match(line):
            marker = m[1] + " "
        else:
            out.append(marker + line)
            marker = ""
    return out
