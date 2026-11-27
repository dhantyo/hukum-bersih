"""Validate the Akoma Ntoso XML written by `hukum-rapih build-akn` against the OASIS schema.

    uv run python scripts/validate_akn.py dir [--report-only] [--examples N]

The OASIS Akoma Ntoso 3.0 XSD (and xml.xsd, which it imports) is downloaded from the OASIS
server into a cache directory and checked against pinned sha256 values (not vendored).
Prints the errors grouped by kind with counts and the first files for each kind.
Exit 1 if any file is invalid (unless --report-only).
"""

import argparse
import hashlib
import re
import sys
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

from lxml import etree

BASE = "https://docs.oasis-open.org/legaldocml/akn-core/v1.0/os/part2-specs/schemas/"
SCHEMA_FILES = {
    "akomantoso30.xsd": "6f61fe84cbb6f8cb0e8418cd67b74a63da9990e6573b5a3491f623184f45c4fd",
    "xml.xsd": "61960fb3131e38022caad5360e2f33a3382578ab3c80cd58bd74320ede61b20c",
}
DEFAULT_CACHE = Path(__file__).resolve().parents[1] / "cache" / "akn-schema"


def fetch_schema(cache: Path) -> Path:
    cache.mkdir(parents=True, exist_ok=True)
    for name, want in SCHEMA_FILES.items():
        path = cache / name
        if not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest() != want:
            with urllib.request.urlopen(BASE + name, timeout=60) as r:
                path.write_bytes(r.read())
            got = hashlib.sha256(path.read_bytes()).hexdigest()
            if got != want:
                sys.exit(f"{name}: sha256 {got} does not match the pinned {want}")
    return cache / "akomantoso30.xsd"


def error_kind(message: str) -> str:
    """Strip the parts that vary per file so equal mistakes group together."""
    msg = re.sub(r"^Element '\{[^}]*\}(\w+)'", r"Element '\1'", message)
    msg = re.sub(r"(attribute '\w+'): '[^']*'", r"\1: 'V'", msg)
    msg = re.sub(r"'[^']*'", lambda m: m.group(0) if len(m.group(0)) < 25 else "'...'", msg)
    msg = re.sub(r"\bline \d+\b", "line N", msg)
    return msg[:300]


# A law whose record has no full date (tanggal_penetapan and version date unknown) keeps the
# year cobalt puts in the Work's FRBRdate (akn/build.py); the schema wants a full date, but
# making one up would be fabricating data (CLAUDE.md). Such files are listed, not failed.
BARE_YEAR = "Element 'FRBRdate', attribute 'date': 'V' is not a valid value of the local union type."


def _work_date_is_a_year(tree) -> bool:
    dates = tree.xpath("//*[local-name()='FRBRWork']/*[local-name()='FRBRdate']/@date")
    return bool(dates) and all(re.fullmatch(r"\d{4}", d) for d in dates)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("dir", type=Path, help="the --out folder of `hukum-rapih build-akn`")
    ap.add_argument("--report-only", action="store_true", help="always exit 0")
    ap.add_argument("--examples", type=int, default=3, help="files listed per error kind")
    ap.add_argument("--cache", type=Path, default=DEFAULT_CACHE)
    args = ap.parse_args()

    files = sorted(args.dir.rglob("*.xml"))
    if not files:
        sys.exit(f"no XML files under {args.dir}")
    schema = etree.XMLSchema(etree.parse(str(fetch_schema(args.cache))))

    kinds: Counter[str] = Counter()
    examples: dict[str, list[str]] = defaultdict(list)
    invalid, undated = 0, []
    for f in files:
        try:
            tree = etree.parse(str(f))
            ok = schema.validate(tree)
            errors = [error_kind(e.message) for e in schema.error_log]
        except etree.XMLSyntaxError as e:
            ok, errors = False, [f"XML syntax: {error_kind(str(e))}"]
        if ok:
            continue
        if set(errors) == {BARE_YEAR} and _work_date_is_a_year(tree):
            undated.append(str(f))        # no full date known for the law: not made up
            continue
        invalid += 1
        for kind in set(errors):
            kinds[kind] += 1
            if len(examples[kind]) < args.examples:
                examples[kind].append(str(f))

    print(f"{len(files)} files checked, {invalid} invalid, {len(undated)} with no known date")
    for f in undated:
        print(f"  no known date (Work FRBRdate is the year only): {f}")
    for kind, n in kinds.most_common():
        print(f"\n{n:6d} files  {kind}")
        for ex in examples[kind]:
            print(f"         e.g. {ex}")
    return 0 if invalid == 0 or args.report_only else 1


if __name__ == "__main__":
    sys.exit(main())
