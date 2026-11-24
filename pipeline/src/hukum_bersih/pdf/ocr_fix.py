"""Correct words that OCR misread on scanned pages: a spell checker that acts only when it is
confident (decision 0013).

For each word of a law's OCR'd text that our word list does not know, every word one letter
substitution away (Norvig, "How to Write a Spelling Corrector", without insertions and
deletions: a trailing letter may be content, "Hurufj" is "Huruf j") or one shape confusion away
("rn" read for "m") is a candidate; for a capitalised word, which may be a name the dictionaries
lack ("Kec. Sepatan"), only a shape confusion. The word is
corrected only when all of these hold:

- it is letters only and not a Roman numeral (numbers are never touched), at least ``MIN_LENGTH`` long, not mixed case;
- it is in neither our word list nor Hunspell's Indonesian or English dictionary, so real words
  the laws rarely use ("kelab", "rerata", "hostel"), place names ("Gamping") and old spelling
  ("jang", "Djakarta") stay as read;
- the law reads it at most ``MAX_REPEATS`` times: a misread is a one-off, a name or term the
  dictionaries lack repeats ("Perkada", "IUPK");
- the best candidate occurs at least ``MIN_HERE`` times in the same law and in at least
  ``MIN_DOCS`` of our typed texts, and holds at least ``CONFIDENCE`` of all candidates' scores
  (number of typed texts it appears in, times ``SHAPE_WEIGHT`` when a shape confusion explains
  it).

Everything else unknown is left as read and counted (``Fixes.suspects``) for a person to check.
Without Hunspell nothing is corrected.

Data: ``ocr_rules/lexicon.txt`` (``scripts/build_lexicon.py``), ``ocr_rules/lexicon-extra.txt``
(by hand), ``ocr_rules/confusions.yaml`` (by hand).
"""

from __future__ import annotations

import re
import shutil
import string
import subprocess
from collections import Counter
from dataclasses import dataclass, field
from functools import cache
from pathlib import Path

import yaml

RULES = Path(__file__).parent / "ocr_rules"
DICTIONARIES = "id_ID,en_US"     # Hunspell's; found through $DICPATH or the system's folders
MIN_LENGTH = 4
MAX_REPEATS = 2
MIN_HERE = 2
MIN_DOCS = 20
SHAPE_WEIGHT = 20
CONFIDENCE = 0.9
WORD = re.compile(r"[A-Za-z]+")
ROMAN = re.compile(r"[IVXLC]+[A-Z]?")   # "XIIA" (an inserted BAB): a number, never a word


@dataclass
class Fixes:
    changed: list[tuple[str, str]] = field(default_factory=list)
    suspects: list[str] = field(default_factory=list)
    checker: str = "hunspell"           # "none" when Hunspell was missing: nothing corrected


@cache
def confusions() -> tuple[tuple[str, str], ...]:
    rules = yaml.safe_load((RULES / "confusions.yaml").read_text())
    return tuple((r["read"], r["meant"]) for r in rules)


@cache
def lexicon() -> dict[str, int]:
    words = {}
    for line in (RULES / "lexicon.txt").read_text().splitlines():
        word, docs = line.split("\t")
        words[word] = int(docs)
    for line in (RULES / "lexicon-extra.txt").read_text().splitlines():
        if (word := line.split("#", 1)[0].strip().lower()):
            words.setdefault(word, 0)
    return words


def dictionary_words(words: set[str]) -> set[str] | None:
    """The ``words`` Hunspell accepts, or None when Hunspell or its dictionaries are missing."""
    if not shutil.which("hunspell"):
        return None
    run = subprocess.run(["hunspell", "-d", DICTIONARIES, "-G"], input="\n".join(sorted(words)),
                         capture_output=True, text=True, check=False)
    if run.returncode != 0 or "Can't open" in run.stderr:
        return None
    return set(run.stdout.split())


def _substitutions(word: str) -> set[str]:
    """Words one letter substitution away. No letters added or dropped: a trailing letter may
    be content ("Hurufj" is "Huruf j", "Provinsii" a subscript i)."""
    return {word[:i] + c + word[i + 1:] for i in range(len(word)) for c in string.ascii_lowercase}


def _shapes(word: str) -> set[str]:
    return {word[:m.start()] + meant + word[m.start() + len(read):]
            for read, meant in confusions()
            for m in re.finditer(f"(?={re.escape(read)})", word)}


def correction(word: str, here: Counter[str], name: bool = False) -> str | None:
    """The confident correction of the unknown ``word`` (lower case) in a law whose word counts
    are ``here``, or None. ``name``: the word is capitalised, so it may be a name the
    dictionaries lack ("Sepatan", "Binuang"): only a shape confusion may change it."""
    if here[word] > MAX_REPEATS:
        return None
    words = lexicon()
    shapes = _shapes(word)
    pool = shapes if name else _substitutions(word) | shapes
    scores = {w: words[w] * (SHAPE_WEIGHT if w in shapes else 1)
              for w in pool if words.get(w) and here[w] >= MIN_HERE}
    if not scores:
        return None
    best = max(scores, key=scores.get)
    if words[best] < MIN_DOCS or scores[best] < CONFIDENCE * sum(scores.values()):
        return None
    return best


def _same_case(new: str, like: str) -> str | None:
    if like.islower():
        return new
    if like.isupper():
        return new.upper()
    if like[0].isupper() and like[1:].islower():
        return new.capitalize()
    return None                                   # mixed case ("PresiDen"): leave it


def fix_lines(lines: list[str]) -> tuple[list[str], Fixes]:
    """One law's OCR'd lines with its confident corrections made."""
    here = Counter(w.lower() for ln in lines for w in WORD.findall(ln))
    known = lexicon()
    unknown = {w for ln in lines for w in WORD.findall(ln)
               if len(w) >= MIN_LENGTH and w.lower() not in known and _same_case("x", w)
               and not ROMAN.fullmatch(w)}
    real = dictionary_words(unknown)
    fixes = Fixes(checker="hunspell" if real is not None else "none")

    def one(m: re.Match) -> str:
        word = m[0]
        if word not in unknown or (real is not None and word in real):
            return word
        new = correction(word.lower(), here, not word.islower()) if real is not None else None
        if new is None:
            fixes.suspects.append(word)
            return word
        new = _same_case(new, word)
        if word[0] == "l" and new[0] == "i":          # a capital I read as l: "lndonesia"
            new = "I" + new[1:]
        fixes.changed.append((word, new))
        return new

    return [WORD.sub(one, ln) for ln in lines], fixes
