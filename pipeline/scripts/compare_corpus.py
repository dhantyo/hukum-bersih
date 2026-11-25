"""Compare two corpus stages file by file: ``compare_corpus.py <a> <b> [--under laws]``.

Prints how many files differ, are missing from ``b`` or are extra in ``b``, and for each
differing file the first byte that differs with the text around it. Exit status 1 when
anything differs. ``--under`` limits the comparison to one folder of both stages (repeatable).
Example: the Python export against the TypeScript one::

    uv run python scripts/compare_corpus.py ../web-solid/.snapshots/ref /path/to/py --under laws
"""

from __future__ import annotations

import argparse
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


def compare(a_root: Path, b_root: Path, only: list[str]) -> tuple[list[str], list[str], list[str], list[str]]:
    """(same, differing, missing from b, extra in b) as file names."""
    a_files, b_files = files_under(a_root, only), files_under(b_root, only)
    same, differing = [], []
    for name in sorted(a_files & b_files):
        a, b = (a_root / name).read_bytes(), (b_root / name).read_bytes()
        if a == b:
            same.append(name)
        else:
            differing.append(describe(name, a, b))
    return same, differing, sorted(a_files - b_files), sorted(b_files - a_files)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("a", type=Path, help="the reference stage")
    parser.add_argument("b", type=Path, help="the stage to check")
    parser.add_argument("--under", action="append", default=[], metavar="FOLDER",
                        help="compare only this folder (relative to each stage)")
    args = parser.parse_args(argv)

    same, differing, missing, extra = compare(args.a, args.b, args.under)
    for report in differing[:SHOWN]:
        print(report)
    if len(differing) > SHOWN:
        print(f"... and {len(differing) - SHOWN} more differing files")
    for label, names in (("missing from b", missing), ("extra in b", extra)):
        for name in names[:SHOWN]:
            print(f"{label}: {name}")
        if len(names) > SHOWN:
            print(f"... and {len(names) - SHOWN} more {label}")
    print(f"{len(same)} identical, {len(differing)} differing, "
          f"{len(missing)} missing, {len(extra)} extra")
    return 1 if differing or missing or extra else 0


if __name__ == "__main__":
    sys.exit(main())
