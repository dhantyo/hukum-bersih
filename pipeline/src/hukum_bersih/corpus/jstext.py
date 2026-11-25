"""The few JavaScript string rules the web code relies on, so the corpus text matches it:
``\\s`` and ``trim`` (a different set of characters than Python's), the Indonesian title
case of ``web/src/lib/title.ts`` and the slug of ``koleksi.ts``, and the sort of
``localeCompare`` for the names of collections.
"""

from __future__ import annotations

import re
import unicodedata

# JavaScript's \s and String.trim(): Python's \s lacks U+FEFF and adds U+001C..U+001F
WS = r"[\t\n\v\f\r    -     　﻿]"
_WS_RUN = re.compile(f"{WS}+")
_WS_EDGE = re.compile(f"^{WS}+|{WS}+$")


def trim(text: str) -> str:
    return _WS_EDGE.sub("", text)


def collapse(text: str) -> str:
    """``text.replace(/\\s+/g, " ").trim()``"""
    return trim(_WS_RUN.sub(" ", text))


# --- title case (web/src/lib/title.ts) ---------------------------------------------------

_SMALL = frozenset([
    "dan", "atau", "di", "ke", "dari", "yang", "untuk", "tentang", "atas", "terhadap", "dengan",
    "pada", "dalam", "oleh", "serta", "bagi", "sebagai", "antara", "menjadi", "kepada", "tanpa",
    "melalui", "secara", "beserta", "mengenai", "of", "the",
])
# Acronyms and roman numerals stay upper case.
_KEEP_UPPER = re.compile(
    r"^(?:[IVXLC]+|RI|NRI|NKRI|DPR|DPRD|DPD|MPR|BPK|BPKP|KPK|OJK|BI|APBN|APBD|KUHP|KUHAP|ITE|TNI"
    r"|POLRI|BUMN|BUMD|BUMDES|PNPS|UUD|UU|PP|HAM|ASN|PNS|BPJS|LN|TLN|IUP|IUPK|IPR|WIUP|WIUPK|WPR"
    r"|WUP|WPN|WP|AMDAL|NPWP|PPN|PPH|PPNBM|PBB|SDA|SDM)$")
_TITLE_SPLIT = re.compile(rf"({WS}+|-|/|\()")
_LETTER = re.compile(r"[a-z]")


def judul(text: str) -> str:
    """"PELINDUNGAN SAKSI DAN KORBAN" -> "Pelindungan Saksi dan Korban"."""
    words = _TITLE_SPLIT.split(text.lower())
    out = []
    for k, word in enumerate(words):
        if not _LETTER.search(word):
            out.append(word)
        elif _KEEP_UPPER.match(word.upper()):
            out.append(word.upper())
        elif k > 0 and word in _SMALL:
            out.append(word)
        else:
            out.append(word[0].upper() + word[1:])
    return re.sub(f"^{WS}+", "", "".join(out))


# --- slug (web/src/lib/koleksi.ts) -------------------------------------------------------

def slugify(text: str) -> str:
    folded = unicodedata.normalize("NFKD", text.lower())
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", folded))


# --- localeCompare(b, "id") for names ----------------------------------------------------

# ICU's order of the punctuation that occurs in titles: spaces, then these, then digits, then
# letters. Anything else sorts after them by code point.
_PUNCTUATION = " _-,;:!?.'\"()[]{}@*/\\&#%`^+<=>|~$"


def _primary(char: str) -> tuple[int, int]:
    if char in _PUNCTUATION:
        return (0, _PUNCTUATION.index(char))
    if char.isdigit():
        return (1, int(char))
    if char.isalpha():
        return (2, ord(char))
    return (0, len(_PUNCTUATION) + ord(char))


def locale_key(text: str) -> tuple:
    """A sort key that orders names as ``a.localeCompare(b, "id")`` does: by letters ignoring
    case and accents, then by accents, then lower case before upper case."""
    decomposed = unicodedata.normalize("NFD", text)
    base = [c for c in decomposed if not unicodedata.combining(c)]
    accents = [c for c in decomposed if unicodedata.combining(c)]
    folded = [c.lower() for c in base]
    return ([_primary(c) for c in folded], accents, [c.isupper() for c in base])
