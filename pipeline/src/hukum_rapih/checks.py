"""Self-checks on a law's Bluebell text, run at the end of every parse (decision 0026).

A check is a row of ``CHECKS``: a stable name (stored on the record), the input it needs, and a
function of the text that returns None when the text passes or a short detail when it fails.
``run_checks`` runs every row it has the input for. ``convert_pdf``
(sources/peraturan_go_id.py) keeps a stored text when a new parse fails a check the stored text
passes; ``scripts/check_texts.py`` runs the checks over the stored texts.
"""

from __future__ import annotations

import re
from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass
from functools import cached_property
from itertools import pairwise
from typing import Literal, NamedTuple

from .akn.bluebell import KEYWORDS
from .akn.build import to_akn
from .closing import conclusions, parse

CHECKS_VERSION = 2   # raise it when a check changes, so results of older checks show as stale
#                      2: front_matter

# Lowest share of the PDF's words a text must keep to pass. 2026-11-28: the regression set
# (tests/regression.yaml) on CI ran from 0.9798 (UU 3/2019) to 0.9997, every law with its
# expected counts; 0.97 sits under the lowest, so a text that loses 3% of the words fails.
WORD_COVERAGE_MIN = 0.97
# Highest share of a text's words the OCR spell fix may leave unknown. 2026-11-28: the OCR'd
# laws of the regression set ran from 0.0018 to 0.021 (UU 2/2025) on CI; the 332 stored OCR'd
# texts reach 0.037 at the 99th percentile and 0.074 at most (UU 71/2024), so 0.05 fails only
# the outliers.
OCR_UNKNOWN_MAX = 0.05

LEAKS = {
    "page-turn": re.compile(r"[^.\s]\s*(?:…|\.\s?\.\s?\.)\.?\s*$", re.MULTILINE),
    "page no.": re.compile(r"(?:^|\s)-\s*\d{1,3}\s*-(?:\s|$)", re.MULTILINE),
    "watermark": re.compile(r"depkumham|peraturan\.go\.id|jdih\.", re.IGNORECASE),
    "SK No": re.compile(r"\bSK\s*No\b"),
    "browser": re.compile(r"\d{1,2}:\d{2}\s*[AP]M\b|https?://"),
}
ART = re.compile(r"^ *ART ([0-9]+[A-Z]?|[IVXLC]+) -", re.MULTILINE)
# a heading the parser missed shows as "Pasal N" glued into the text after a sentence:
# "… Cukup jelas. Pasal 5: Cukup jelas." (UU 147/2024), "… perundang-undangan. ' Pasal 8 Pada"
GLUED = re.compile(r"[.;:]\W{0,3}\s+Pasal \d+[A-Z]?\s*[:.]?\s+(?:Cukup jelas|[A-Z(])")
AYAT_OR_ART = re.compile(r"^ *(?:ART (?P<pasal>\S+) -|PARA \((?P<ayat>\d+)\)$)", re.MULTILINE)
LETTER = re.compile(r"(?:POINT|ITEM) ([a-z])\.")
# Bluebell headings that stand for a printed word ("ART 5 -" is "Pasal 5" in the PDF)
PRINTED = {"ART": "Pasal", "CHAPTER": "BAB", "PART": "Bagian", "SUBPART": "Paragraf"}
HEADING = re.compile(rf"^( *)({'|'.join(PRINTED)})\b", re.MULTILINE)
# the title (PREFACE) and the part of the text after it
FRONT = re.compile(r"PREFACE\n(?P<title>(?:(?: .*)?\n)*)(?P<next>\S*)")
# Most words a title may have. 2026-11-28: the stored titles reach 64 words at the 99th
# percentile and 204 at most (the UUD 1945, Pembukaan included), leaving out UU 15/2009's, a
# Penjelasan of 784 words; a file joined before the law runs into the title until the law's
# opening, so it is far longer.
TITLE_WORDS_MAX = 400


def words(text: str) -> Counter[str]:
    """The lowercase word tokens of ``text``, each with how often it occurs."""
    return Counter(re.findall(r"\w+", text.lower()))


def word_coverage(text: str, pdf_words: Counter[str]) -> float:
    """The share of the PDF's words found in ``text``, each counted at most as often as the PDF
    has it (a multiset intersection), so the order of the parts does not matter."""
    printed = HEADING.sub(lambda m: m[1] + PRINTED[m[2]], text)
    return sum((pdf_words & words(printed)).values()) / sum(pdf_words.values())


@dataclass
class Text:
    """A text and what the checks read from it, worked out once."""
    rec: dict
    text: str
    word_coverage: float | None
    ocr_unknown_rate: float | None

    @cached_property
    def body(self) -> str:
        """Everything before the first attachment: preface, preamble, body and closing."""
        return self.text.partition("ATTACHMENT")[0]

    @cached_property
    def penjelasan(self) -> str:
        return self.text.partition("ATTACHMENT Penjelasan")[2].split("\nATTACHMENT ")[0]

    @cached_property
    def arts(self) -> list[str]:
        return ART.findall(self.body)

    @property
    def amending(self) -> bool:
        """Its own pasal are I, II …; the pasal, ayat and lists it quotes stay in Pasal I."""
        return bool(self.arts) and bool(re.fullmatch(r"[IVXLC]+", self.arts[0]))


def _front_matter(t: Text) -> str | None:
    """The text opens with the law's title, then its opening ("DENGAN RAHMAT …", Menimbang);
    the UUD 1945 prints its Pembukaan in the title. Files joined in the wrong order (decision
    0023) open with the Penjelasan, a Lampiran or the middle of the body instead; 2026-11-28:
    the one stored text that failed, UU 15/2009, holds only its Penjelasan."""
    m = FRONT.match(t.text)
    if not m:
        return "no title"
    if re.search(r"PENJELASAN\s+ATAS\b", m["title"]):
        return "title is a Penjelasan"
    if re.match(r"\s*LAMPIRAN\b", m["title"]):
        return "title is a Lampiran"
    if (n := len(re.findall(r"\w+", m["title"]))) > TITLE_WORDS_MAX:
        return f"title of {n} words > {TITLE_WORDS_MAX}"
    if m["next"] != "PREAMBLE" and "PEMBUKAAN" not in m["title"]:
        return f"title followed by {m['next'] or 'nothing'}"
    return None


def _invalid_akn(t: Text) -> str | None:
    try:
        to_akn(t.text, t.rec["akn"], "act")
    except Exception as e:  # noqa: BLE001 - any failure to build is the finding
        return f"{type(e).__name__}: {str(e)[:80]}"
    return None


def _pasal_gap(t: Text) -> str | None:
    if not t.arts:
        return "no pasal"
    nums = [int(a) if a.isdigit() else None for a in t.arts]
    if None in nums:                                 # Roman, or an inserted 5A: not checked
        return None
    start = [f"starts {nums[0]}"] if nums[0] != 1 else []
    gaps = [f"{a}->{b}" for a, b in pairwise(nums) if b != a + 1]
    return " ".join(start + gaps[:3]) or None


def _glued(part: str) -> int:
    # not: a reference in the Mengingat list or a list item ("d. Pasal 89 Undang-undang Dasar"),
    # or to another law ("Pasal 33 Undang-Undang Dasar 1945")
    return sum(1 for m in GLUED.finditer(part)
               if not re.search(r"Mengingat|POINT|ITEM", part[max(0, m.start() - 14):m.start() + 1])
               and not re.match(r"\s*(?:Undang|UUD|ayat|huruf)", part[m.end() - 1:], re.IGNORECASE))


def _missed_heading(t: Text) -> str | None:
    if t.amending:
        return None
    found = [f"{where} {n}" for part, where in ((t.body, "body"), (t.penjelasan, "penjelasan"))
             if (n := _glued(part))]
    return ", ".join(found) or None


def _page_furniture(t: Text) -> str | None:
    found = [f"{name} {n}" for name, rx in LEAKS.items() if (n := len(rx.findall(t.body)))]
    return ", ".join(found) or None


def _no_closing_date(t: Text) -> str | None:
    signed = parse(conclusions(t.text)).get("signed") or {}
    return None if signed.get("date") else "no date of signing"


def _ayat_order(t: Text) -> str | None:
    """Ayat (1), (2), (3) … in each body pasal; an inserted (1a) is not counted."""
    if t.amending:
        return None
    wrong, pasal, last = [], "", 0
    for m in AYAT_OR_ART.finditer(t.body):
        if m["pasal"]:
            pasal, last = m["pasal"], 0
            continue
        n = int(m["ayat"])
        if n != last + 1:
            wrong.append(f"Pasal {pasal} " + (f"({last})->({n})" if last else f"starts ({n})"))
        last = n
    return ", ".join(wrong[:3]) or None


def _letter_fault(letter: str | None, prev: str | None) -> str | None:
    """Why item ``letter`` cannot come after ``prev`` in its list, or None. A list starts at
    "a.", or at "i." of Roman numerals (unless it follows "h."); a numbered item is not judged."""
    if letter is None or letter == "a" or (letter == "i" and prev != "h"):
        return None
    if prev is None:
        return f"starts {letter}."
    return None if ord(letter) == ord(prev) + 1 else f"{prev}.->{letter}."


def _list_order(t: Text) -> str | None:
    """Letters a., b., c. … in each list: the items at one depth under one parent. Text between
    the items does not end a list; a heading or ayat at the items' depth does."""
    if t.amending:
        return None
    wrong, where = [], "preamble"
    last: dict[int, str | None] = {}                 # depth -> last letter of the list open there
    for line in t.body.splitlines():
        stripped = line.lstrip(" ")
        if not stripped:
            continue
        depth, keyword = len(line) - len(stripped), stripped.split(" ", 1)[0]
        item = keyword in ("POINT", "ITEM")
        ends_own = keyword in KEYWORDS and not item
        last = {d: v for d, v in last.items() if d < depth or (d == depth and not ends_own)}
        if keyword == "ART":
            where = f"Pasal {stripped.split(' ')[1]}"
        if item:
            letter = m[1] if (m := LETTER.fullmatch(stripped)) else None
            if fault := _letter_fault(letter, last.get(depth)):
                wrong.append(f"{where} {fault}")
            last[depth] = letter
    return ", ".join(wrong[:3]) or None


def _word_coverage(t: Text) -> str | None:
    return None if t.word_coverage >= WORD_COVERAGE_MIN else f"{t.word_coverage} < {WORD_COVERAGE_MIN}"


def _ocr_unknown(t: Text) -> str | None:
    return None if t.ocr_unknown_rate <= OCR_UNKNOWN_MAX else f"{t.ocr_unknown_rate} > {OCR_UNKNOWN_MAX}"


Needs = Literal["text", "pdf", "ocr"]   # the text alone, the PDF's words, the OCR unknown-word count


class CheckSpec(NamedTuple):
    name: str
    needs: Needs
    run: Callable[[Text], str | None]


CHECKS = (
    CheckSpec("invalid_akn", "text", _invalid_akn),
    CheckSpec("front_matter", "text", _front_matter),
    CheckSpec("pasal_gap", "text", _pasal_gap),
    CheckSpec("missed_heading", "text", _missed_heading),
    CheckSpec("page_furniture", "text", _page_furniture),
    CheckSpec("no_closing_date", "text", _no_closing_date),
    CheckSpec("ayat_order", "text", _ayat_order),
    CheckSpec("list_order", "text", _list_order),
    CheckSpec("word_coverage", "pdf", _word_coverage),
    CheckSpec("ocr_unknown", "ocr", _ocr_unknown),
)


@dataclass(frozen=True)
class TextChecks:
    failed: dict[str, str]        # name -> detail, in the order of CHECKS
    passed: frozenset[str]        # run and passed; a check without its input is in neither
    word_coverage: float | None
    ocr_unknown_rate: float | None

    def worse_than(self, stored: TextChecks) -> list[str]:
        """The checks this text fails that ``stored`` passes."""
        return [name for name in self.failed if name in stored.passed]

    def as_record(self) -> dict:
        """The ``checks`` field of a text version (``Checks`` in records.py)."""
        numbers = {"word_coverage": self.word_coverage, "ocr_unknown_rate": self.ocr_unknown_rate}
        return {"version": CHECKS_VERSION,
                "failed": [{"name": name, "detail": detail} for name, detail in self.failed.items()],
                **{k: v for k, v in numbers.items() if v is not None}}


def run_checks(rec: dict, text: str, pdf_words: Counter[str] | None = None,
               ocr_unknown: int | None = None) -> TextChecks:
    """Every check of ``text`` (a version of the law ``rec``) it has the input for.
    ``pdf_words``: ``words`` of the lines the parser read from the PDF (text layer or OCR);
    ``ocr_unknown``: the words the OCR spell fix left unknown (the version's ``ocr_unknown``)."""
    count = len(re.findall(r"\w+", text))
    t = Text(rec, text,
             round(word_coverage(text, pdf_words), 4) if pdf_words else None,
             round(ocr_unknown / count, 4) if ocr_unknown is not None and count else None)
    have = {"text": True, "pdf": t.word_coverage is not None, "ocr": t.ocr_unknown_rate is not None}
    results = {c.name: c.run(t) for c in CHECKS if have[c.needs]}
    return TextChecks({name: d for name, d in results.items() if d is not None},
                      frozenset(name for name, d in results.items() if d is None),
                      t.word_coverage, t.ocr_unknown_rate)
