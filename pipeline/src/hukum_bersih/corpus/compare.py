"""Compare two versions pasal by pasal (``web/src/lib/compare.ts``).

Pasal numbers shift between drafts, so pasal are matched by content similarity (an
order-preserving alignment, then a pass for moved pasal), then ayat by ayat, then word by word.
The word diff runs on ``rapidiff`` (Myers, in Rust) and the semantic cleanup of
``diff-match-patch``; its output can differ from the JavaScript engine in how a few edits are
grouped, never in the pairing of pasal and ayat, which is plain arithmetic.
"""

from __future__ import annotations

import math
from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass
from functools import cache
from typing import Any, Literal

import regex
from diff_match_patch import diff_match_patch
from rapidiff import SequenceMatcher

from .jstext import WS
from .pasal import Pasal, PasalLine, pasal_text
from .write import UNDEFINED

Status = Literal["sama", "berubah", "baru", "dihapus"]
Vector = dict[str, float]
LineVectors = dict[PasalLine, Vector]

# In-order pairs below this similarity are treated as one removed and one added pasal.
MATCH_THRESHOLD = 0.3
# Out-of-order (moved) pairs need stronger evidence.
MOVE_THRESHOLD = 0.35
# Ayat and list items inside a matched pasal.
LINE_THRESHOLD = 0.3
# A "baru" or "dihapus" line points to the most similar line of the other version only if it
# scores at least REF_THRESHOLD and beats the runner-up by REF_MARGIN.
REF_THRESHOLD = 0.3
REF_MARGIN = 0.07
# Below this share of unchanged text a line is shown as removed plus added in full.
REWRITE_THRESHOLD = 0.5
# Versions of one law number their lines authoritatively ("8. Dihapus." is still item 8), so with
# ``by_number`` a line pairs more readily with the line of the same number at the same depth.
# Between drafts items are renumbered and content alone decides.
SAME_NUMBER_BONUS = 0.6

_WORD = regex.compile(r"[\p{L}\p{N}]+")
# a space run, a word, or one other character: JavaScript's \s, not Python's
_TOKEN = regex.compile(rf"{WS}+|[\p{{L}}\p{{N}}]+|[^{WS[1:-1]}\p{{L}}\p{{N}}]")
_FIRST_TOKEN_CHAR = 0x4E00
_LINE_NUMBER = regex.compile(r"\((?P<ayat>[0-9]+)\)|(?P<huruf>[a-z])\.|(?P<angka>[0-9]+)\.")

_cleanup = diff_match_patch()


@dataclass
class Part:
    value: str
    added: bool = False
    removed: bool = False


@dataclass
class LineRef:
    label: str                  # "Pasal 23 ayat (1)"
    side: Literal["a", "b"]     # which version it is in
    pasal: Pasal


@dataclass
class LineDiff:
    """``diganti``: the same ayat, reworded so much that it is shown old and new in full."""

    kind: Literal["sama", "berubah", "baru", "dihapus", "diganti"]
    parts: list[Part]
    a: PasalLine | None = None
    b: PasalLine | None = None
    ref: LineRef | None = None  # for "baru" and "dihapus": the most similar ayat elsewhere


@dataclass
class PasalComparison:
    status: Status
    similarity: float
    renumbered: bool
    moved: bool                 # matched outside the original order (provision relocated)
    lines: list[LineDiff]
    a: Pasal | None = None
    b: Pasal | None = None


@dataclass
class Comparison:
    rows: list[PasalComparison]
    counts: dict[str, int]


@dataclass
class Pair:
    """One result of ``align``: the index in each list, None where that side has no partner."""

    sim: float
    i: int | None = None
    j: int | None = None


# --- similarity of two texts -------------------------------------------------------------

def _words(text: str) -> list[str]:
    return _WORD.findall(text.lower())


@cache
def _bigrams(text: str) -> Counter[str]:
    """Adjacent word pairs: shared legal boilerplate ("sebagaimana dimaksud") counts for less
    than shared wording."""
    w = _words(text)
    grams = w if len(w) < 2 else [f"{w[k]} {x}" for k, x in enumerate(w[1:])]
    return Counter(grams)


def _dice(a: Counter[str], b: Counter[str]) -> float:
    na = sum(a.values())
    nb = sum(b.values())
    common = sum(min(v, a.get(g, 0)) for g, v in b.items())
    if not na and not nb:
        return 1
    return (2 * common) / (na + nb)


def similarity(a: str, b: str) -> float:
    """Dice coefficient on word pairs: 1 = same text, 0 = nothing in common."""
    return _dice(_bigrams(a), _bigrams(b))


def tfidf(texts: list[str]) -> list[Vector]:
    """Unit-length TF-IDF vectors: words common across the texts weigh little."""
    df: Counter[str] = Counter()
    tfs = []
    for text in texts:
        tf = Counter(_words(text))
        df.update(tf.keys())
        tfs.append(tf)
    n = len(texts)
    vectors = []
    for tf in tfs:
        vector: Vector = {}
        norm = 0.0
        for word, count in tf.items():
            x = (1 + math.log(count)) * math.log(1 + n / df[word])
            vector[word] = x
            norm += x * x
        norm = math.sqrt(norm) or 1
        vectors.append({word: x / norm for word, x in vector.items()})
    return vectors


def cosine(a: Vector, b: Vector) -> float:
    # the sum runs over the smaller vector, as the JavaScript did, so rounding is the same
    small, large = (a, b) if len(a) < len(b) else (b, a)
    dot = 0.0
    for word, x in small.items():
        dot += x * large.get(word, 0)
    return dot


def line_vectors(pasal: list[Pasal]) -> LineVectors:
    lines = [line for p in pasal for line in p.lines]
    return dict(zip(lines, tfidf([line.text for line in lines]), strict=True))


# --- alignment ---------------------------------------------------------------------------

def align[T](a: list[T], b: list[T], sim_of: Callable[[T, T], float],
             threshold: float = MATCH_THRESHOLD) -> list[Pair]:
    """Order-preserving alignment maximising the total similarity of the matched pairs."""
    n, m = len(a), len(b)
    sim = [[sim_of(x, y) for y in b] for x in a]
    score = [[0.0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            s = sim[i - 1][j - 1]
            score[i][j] = max(score[i - 1][j], score[i][j - 1],
                              score[i - 1][j - 1] + s if s >= threshold else -math.inf)
    pairs: list[Pair] = []
    i, j = n, m
    while i > 0 or j > 0:
        if i > 0 and j > 0 and sim[i - 1][j - 1] >= threshold \
                and score[i][j] == score[i - 1][j - 1] + sim[i - 1][j - 1]:
            pairs.append(Pair(sim[i - 1][j - 1], i - 1, j - 1))
            i -= 1
            j -= 1
        elif j > 0 and (i == 0 or score[i][j] == score[i][j - 1]):
            # walking backwards, take additions first so that in reading order a removed line
            # is shown before the line that replaced it
            pairs.append(Pair(0, None, j - 1))
            j -= 1
        else:
            pairs.append(Pair(0, i - 1, None))
            i -= 1
    pairs.reverse()
    return pairs


# --- word diff ---------------------------------------------------------------------------

def _whole(value: str, added: bool, removed: bool) -> list[Part]:
    return [Part(value, added, removed)]


def word_diff(a: str, b: str) -> list[Part]:
    """Each word, space run or punctuation mark becomes one character, ``rapidiff`` diffs those,
    the semantic cleanup merges small fragments into readable "old phrase, new phrase" blocks, and
    the characters are decoded back to words."""
    tokens: list[str] = []
    index: dict[str, int] = {}

    def encode(text: str) -> str:
        chars = []
        for token in _TOKEN.findall(text):
            if token not in index:
                index[token] = len(tokens)
                tokens.append(token)
            chars.append(chr(_FIRST_TOKEN_CHAR + index[token]))
        return "".join(chars)

    diffs = _diff_chars(encode(a), encode(b))
    _cleanup.diff_cleanupMerge(diffs)
    _cleanup.diff_cleanupSemantic(diffs)
    return [Part("".join(tokens[ord(c) - _FIRST_TOKEN_CHAR] for c in chars),
                 op == diff_match_patch.DIFF_INSERT, op == diff_match_patch.DIFF_DELETE)
            for op, chars in diffs]


def _diff_chars(a: str, b: str) -> list[tuple[int, str]]:
    """The Myers diff of two strings as ``diff-match-patch`` lists it: (operation, text)."""
    diffs = []
    for tag, a1, a2, b1, b2 in SequenceMatcher(
            None, a, b, algorithm="myers", mode="chars").get_opcodes():
        if tag == "equal":
            diffs.append((diff_match_patch.DIFF_EQUAL, a[a1:a2]))
            continue
        if tag in ("delete", "replace"):
            diffs.append((diff_match_patch.DIFF_DELETE, a[a1:a2]))
        if tag in ("insert", "replace"):
            diffs.append((diff_match_patch.DIFF_INSERT, b[b1:b2]))
    return diffs


def _utf16_length(text: str) -> int:
    return len(text.encode("utf-16-le")) // 2


def _unchanged_share(parts: list[Part], a: str, b: str) -> float:
    """Share of the longer text that is unchanged (lengths as JavaScript counts them)."""
    same = sum(_utf16_length(p.value) for p in parts if not p.added and not p.removed)
    return same / max(_utf16_length(a), _utf16_length(b), 1)


# --- ayat by ayat, pasal by pasal --------------------------------------------------------

def diff_lines(a: Pasal, b: Pasal, vectors: LineVectors, by_number: bool = False) -> list[LineDiff]:
    """Align the lines (TF-IDF cosine, so a reworded ayat still pairs up), then word-diff inside
    each matched pair."""
    def similarity_of(x: PasalLine, y: PasalLine) -> float:
        sim = cosine(vectors[x], vectors[y])
        same_number = by_number and x.num and x.num == y.num and x.indent == y.indent
        return sim + SAME_NUMBER_BONUS if same_number else sim

    pairs = align(a.lines, b.lines, similarity_of, LINE_THRESHOLD)
    out: list[LineDiff] = []
    for pair in pairs:
        la = None if pair.i is None else a.lines[pair.i]
        lb = None if pair.j is None else b.lines[pair.j]
        if la and lb:
            if la.text == lb.text:
                out.append(LineDiff("sama", _whole(lb.text, False, False), la, lb))
                continue
            parts = word_diff(la.text, lb.text)
            if _unchanged_share(parts, la.text, lb.text) < REWRITE_THRESHOLD:
                out.append(LineDiff("diganti", _whole(la.text, False, True)
                                    + _whole(lb.text, True, False), la, lb))
            else:
                out.append(LineDiff("berubah", parts, la, lb))
        elif la:
            out.append(LineDiff("dihapus", _whole(la.text, False, True), a=la))
        else:
            out.append(LineDiff("baru", _whole(lb.text, True, False), b=lb))
    return out

@dataclass
class _Versions:
    """The two versions being compared, with what is computed once for both."""

    old: list[Pasal]
    new: list[Pasal]
    old_texts: list[str]
    new_texts: list[str]
    vectors: LineVectors

    @classmethod
    def of(cls, old: list[Pasal], new: list[Pasal]) -> _Versions:
        return cls(old, new, [pasal_text(p) for p in old], [pasal_text(p) for p in new],
                   line_vectors([*old, *new]))

    def paired_row(self, i: int, j: int, sim: float, moved: bool) -> PasalComparison:
        a, b = self.old[i], self.new[j]
        same = self.old_texts[i] == self.new_texts[j]
        return PasalComparison("sama" if same else "berubah", sim, a.label != b.label, moved,
                               diff_lines(a, b, self.vectors), a, b)


def only(pasal: Pasal, kind: Literal["baru", "dihapus"]) -> list[LineDiff]:
    added = kind == "baru"
    return [LineDiff(kind, _whole(line.text, added, not added),
                     b=line if added else None, a=None if added else line)
            for line in pasal.lines]


def _find_moves(pairs: list[Pair], versions: _Versions) -> dict[int, tuple[int, float]]:
    """Pair leftover removed and added pasal that clearly moved elsewhere: old index to
    (new index, similarity), strongest evidence first."""
    lonely_old = [p.i for p in pairs if p.j is None]
    lonely_new = dict.fromkeys(p.j for p in pairs if p.i is None)
    candidates = [(i, j, similarity(versions.old_texts[i], versions.new_texts[j]))
                  for i in lonely_old for j in lonely_new]
    candidates = [c for c in candidates if c[2] >= MOVE_THRESHOLD]
    candidates.sort(key=lambda c: c[2], reverse=True)
    moves: dict[int, tuple[int, float]] = {}
    for i, j, sim in candidates:
        if i in moves or j not in lonely_new:
            continue
        moves[i] = (j, sim)
        del lonely_new[j]
    return moves


def compare(old: list[Pasal], new: list[Pasal]) -> Comparison:
    versions = _Versions.of(old, new)
    pairs = align(versions.old_texts, versions.new_texts, similarity)
    rows = _rows(pairs, _find_moves(pairs, versions), versions)
    _add_refs(rows, versions)
    counts = {"sama": 0, "berubah": 0, "baru": 0, "dihapus": 0, "renumbered": 0, "moved": 0}
    for row in rows:
        counts[row.status] += 1
        counts["renumbered"] += row.renumbered
        counts["moved"] += row.moved
    return Comparison(rows, counts)


def _rows(pairs: list[Pair], moves: dict[int, tuple[int, float]],
          versions: _Versions) -> list[PasalComparison]:
    moved_targets = {j for j, _ in moves.values()}
    rows: list[PasalComparison] = []
    for pair in pairs:
        i, j = pair.i, pair.j
        if i is not None and j is not None:
            rows.append(versions.paired_row(i, j, pair.sim, False))
        elif j is not None:
            if j not in moved_targets:                     # a moved pasal is shown where it came from
                rows.append(PasalComparison("baru", 0, False, False,
                                            only(versions.new[j], "baru"), b=versions.new[j]))
        elif i in moves:
            rows.append(versions.paired_row(i, *moves[i], True))
        else:
            rows.append(PasalComparison("dihapus", 0, False, False,
                                        only(versions.old[i], "dihapus"), a=versions.old[i]))
    return rows


def _line_label(pasal: Pasal, line: PasalLine) -> str:
    """"Pasal 23 ayat (1)", "Pasal 2 huruf a" or "Pasal 1 angka 3" from a line's number."""
    found = _LINE_NUMBER.fullmatch(line.num) if line.num else None
    if not found:
        return pasal.label
    if found["ayat"]:
        return f"{pasal.label} ayat ({found['ayat']})"
    if found["huruf"]:
        return f"{pasal.label} huruf {found['huruf']}"
    return f"{pasal.label} angka {found['angka']}"


def _add_refs(rows: list[PasalComparison], versions: _Versions) -> None:
    """Point every "baru" or "dihapus" line at its clear counterpart in the other version, so a
    pasal split in two stays traceable although rows pair pasal one to one."""
    entries = [("a", p, line) for p in versions.old for line in p.lines]
    entries += [("b", p, line) for p in versions.new for line in p.lines]
    for row in rows:
        # lines already paired in this row are taken; unpaired ones of the same pasal are fair
        # targets (clauses that swapped places cannot both be paired in order)
        taken = {id(side) for line in row.lines if line.a and line.b for side in (line.a, line.b)}
        for line in row.lines:
            if line.kind in ("baru", "dihapus"):
                line.ref = _counterpart(line, entries, taken, versions.vectors)


def _counterpart(line: LineDiff, entries: list[tuple[str, Pasal, PasalLine]], taken: set[int],
                 vectors: LineVectors) -> LineRef | None:
    """The line of the other version most like ``line``, if it is clearly the best match."""
    own = line.b if line.kind == "baru" else line.a
    other = "a" if line.kind == "baru" else "b"
    best_sim, best, second = 0.0, None, 0.0
    for side, pasal, candidate in entries:
        if side != other or id(candidate) in taken:
            continue
        sim = cosine(vectors[own], vectors[candidate])
        if sim > best_sim:
            second = best_sim
            best_sim, best = sim, (pasal, candidate)
        elif sim > second:
            second = sim
    if best and best_sim >= REF_THRESHOLD and best_sim - second >= REF_MARGIN:
        return LineRef(_line_label(*best), other, best[0])
    return None


# --- the JSON of a line ------------------------------------------------------------------

def _line_side(line: PasalLine | None) -> Any:
    if line is None:
        return UNDEFINED
    return {"num": UNDEFINED if line.num is None else line.num, "indent": line.indent}


def line_json(line: LineDiff, anchors: dict[int, str]) -> dict[str, Any]:
    """One line of a comparison as the page reads it; ``anchors`` names the pasal a ``ref`` points
    at (it is empty for a line that has none)."""
    if line.ref and id(line.ref.pasal) not in anchors:
        raise ValueError("A cross-reference points at a pasal outside the rows")
    return {
        "kind": line.kind, "a": _line_side(line.a), "b": _line_side(line.b),
        "parts": [{"value": p.value, "added": p.added, "removed": p.removed} for p in line.parts],
        "ref": UNDEFINED if line.ref is None else {
            "label": line.ref.label, "side": line.ref.side,
            "anchor": anchors[id(line.ref.pasal)]},
    }
