"""``collections/<slug>/comparisons/``: every version of an amended law set against every later one,
pasal by pasal, so no page diffs anything per request. ``index.json`` lists the versions, oldest
first; ``<older>...<newer>.json`` holds the pasal that read differently in the two
(``version_history.compare_data`` is the input). There is no file for the newer-to-older
direction: the pages read the older version first and fill the columns from either side.

A pasal is compared line by line (``compare.diff_lines``), and lines of the same number are
paired first (``numbered``, kept only where it pairs them differently from ``lines``).
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from .compare import LineDiff, diff_lines, line_json, line_vectors, only
from .pasal import Pasal, PasalLine
from .write import write_json

_VERSION_ID = re.compile(r"[a-z0-9_-]+")

_SLOTS = {"d": "deleted", "u": "unreadable", None: "absent"}


def _state(slot: Any) -> str:
    """How a pasal stands in one version: it has text, or was deleted, or its new wording is
    not readable, or the version has no such pasal yet."""
    return "text" if isinstance(slot, list) else _SLOTS[slot]


def _pasal(num: str, slot: Any) -> Pasal | None:
    if not isinstance(slot, list):
        return None
    return Pasal(f"Pasal {num}", num, f"cmp-{num}", None,
                 [PasalLine(text, indent, line_num) for line_num, text, indent in slot])


def _slot_at(history: list[list], version: int) -> Any:
    return next(slot for index, slot in reversed(history) if index <= version)


def _line_diffs(before: Pasal | None, after: Pasal | None, by_number: bool) -> list[LineDiff]:
    """Both texts are diffed; one text alone is all added or all removed."""
    if before and after:
        return diff_lines(before, after, line_vectors([before, after]), by_number)
    if after:
        return only(after, "baru")
    return only(before, "dihapus") if before else []


def _lines(diffs: list[LineDiff]) -> list[dict[str, Any]]:
    return [line_json(line, {}) for line in diffs]


def _row(num: str, before: Any, after: Any) -> dict[str, Any]:
    old, new = _pasal(num, before), _pasal(num, after)
    return {"num": num, "before": _state(before), "after": _state(after),
            "lines": _lines(_line_diffs(old, new, by_number=False))}


def _with_numbered(row: dict[str, Any], before: Any, after: Any) -> None:
    """Add the lines as the law pages pair them, when that differs from ``lines``."""
    old, new = _pasal(row["num"], before), _pasal(row["num"], after)
    if old and new:
        numbered = _lines(_line_diffs(old, new, by_number=True))
        if numbered != row["lines"]:
            row["numbered"] = numbered


def comparison_record(pasal: list[list], older: int, newer: int) -> dict[str, Any]:
    """The pasal that read differently in version ``older`` and in the later version ``newer``
    (indexes into the versions), diffed from the first to the second."""
    if older >= newer:
        raise ValueError(f"version {older} is not older than version {newer}")
    rows = []
    for num, history in pasal:
        if not any(older < index <= newer for index, _ in history):
            continue
        before, after = _slot_at(history, older), _slot_at(history, newer)
        if before == after:
            continue
        row = _row(num, before, after)
        _with_numbered(row, before, after)
        rows.append(row)
    return {"pasal": rows}


def _pair(older: str, newer: str) -> str:
    for version in (older, newer):
        if not _VERSION_ID.fullmatch(version):
            raise ValueError(f"{version!r} is not a valid name for a file")
    return f"{older}...{newer}"


def write_comparisons(directory: Path, history: dict[str, Any]) -> int:
    """Write the index and every pair of versions of ``history``, older first, into
    ``directory``; returns the number of pairs."""
    directory.mkdir(parents=True)
    versions = history["versions"]
    write_json(directory / "index.json", {"versions": versions}, newline=False)
    pairs = 0
    for older, first in enumerate(versions):
        for newer in range(older + 1, len(versions)):
            write_json(directory / f"{_pair(first['id'], versions[newer]['id'])}.json",
                       comparison_record(history["pasal"], older, newer), newline=False)
            pairs += 1
    return pairs
