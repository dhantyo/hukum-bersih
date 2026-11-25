"""Compare two corpus stages file by file: ``compare_corpus.py <a> <b> [--under laws]``.

Prints how many files differ, are missing from ``b`` or are extra in ``b``, and for each
differing file the first byte that differs with the text around it. Exit status 1 when
anything differs. ``--under`` limits the comparison to one folder of both stages (repeatable).
``--word-diff-parts`` accepts a JSON file whose only difference is how its word diffs ("parts")
group the same two texts: it is counted apart and does not fail the run.
Example: the Python export against the TypeScript one::

    uv run python scripts/compare_corpus.py ../web-solid/.snapshots/ref /path/to/py --under laws
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

CONTEXT = 40          # bytes shown on each side of the first difference
SHOWN = 20            # differing files listed in full


def files_under(root: Path, only: list[str]) -> set[str]:
    bases = [root / name for name in only] if only else [root]
    return {p.relative_to(root).as_posix() for base in bases if base.exists()
            for p in ([base] if base.is_file() else base.rglob("*")) if p.is_file()}


def first_difference(a: bytes, b: bytes) -> int:
    for at, (x, y) in enumerate(zip(a, b)):
        if x != y:
            return at
    return min(len(a), len(b))                 # one file is a prefix of the other


def describe(name: str, a: bytes, b: bytes) -> str:
    at = first_difference(a, b)
    lo = max(0, at - CONTEXT)

    def around(data: bytes) -> str:
        return data[lo:at + CONTEXT].decode("utf-8", errors="replace")

    return (f"{name}: first difference at byte {at} (sizes {len(a)} and {len(b)})\n"
            f"    a: {around(a)!r}\n    b: {around(b)!r}")


def _spelled(parts: list[dict]) -> list[str]:
    """The old and the new text a word diff spells, whatever way it groups the changes."""
    return ["".join(p["value"] for p in parts if not p["added"]),
            "".join(p["value"] for p in parts if not p["removed"])]


def without_grouping(node):
    """``node`` with every word diff ("parts") reduced to the two texts it spells."""
    if isinstance(node, dict):
        return {key: _spelled(value) if key == "parts" else without_grouping(value)
                for key, value in node.items()}
    if isinstance(node, list):
        return [without_grouping(item) for item in node]
    return node


def differs_only_in_grouping(a: bytes, b: bytes) -> bool:
    try:
        return without_grouping(json.loads(a)) == without_grouping(json.loads(b))
    except (ValueError, KeyError, TypeError):
        return False


def compare(a_root: Path, b_root: Path, only: list[str], word_diff_parts: bool = False) -> tuple[
        list[str], list[str], list[str], list[str], list[str]]:
    """(same, differing only in word-diff grouping, differing, missing from b, extra in b) as
    file names; the second list is empty unless ``word_diff_parts``."""
    a_files, b_files = files_under(a_root, only), files_under(b_root, only)
    same, regrouped, differing = [], [], []
    for name in sorted(a_files & b_files):
        a, b = (a_root / name).read_bytes(), (b_root / name).read_bytes()
        if a == b:
            same.append(name)
        elif word_diff_parts and differs_only_in_grouping(a, b):
            regrouped.append(name)
        else:
            differing.append(describe(name, a, b))
    return same, regrouped, differing, sorted(a_files - b_files), sorted(b_files - a_files)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("a", type=Path, help="the reference stage")
    parser.add_argument("b", type=Path, help="the stage to check")
    parser.add_argument("--under", action="append", default=[], metavar="FOLDER",
                        help="compare only this folder (relative to each stage)")
    parser.add_argument("--word-diff-parts", action="store_true",
                        help="count a JSON file that differs only in how its word diffs group "
                             "the same texts apart from the differing files")
    args = parser.parse_args(argv)

    same, regrouped, differing, missing, extra = compare(args.a, args.b, args.under,
                                                         args.word_diff_parts)
    for report in differing[:SHOWN]:
        print(report)
    if len(differing) > SHOWN:
        print(f"... and {len(differing) - SHOWN} more differing files")
    for label, names in (("missing from b", missing), ("extra in b", extra)):
        for name in names[:SHOWN]:
            print(f"{label}: {name}")
        if len(names) > SHOWN:
            print(f"... and {len(names) - SHOWN} more {label}")
    if args.word_diff_parts:
        print(f"{len(regrouped)} differ only in word-diff grouping")
    print(f"{len(same)} identical, {len(differing)} differing, "
          f"{len(missing)} missing, {len(extra)} extra")
    return 1 if differing or missing or extra else 0


if __name__ == "__main__":
    sys.exit(main())
