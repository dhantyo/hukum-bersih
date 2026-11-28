"""Run the self-checks (src/hukum_rapih/checks.py) over every stored text of one kind, without
the PDFs, and print the laws that fail one: the most failed checks first, then the lowest word
coverage. A check that needs the PDF (word coverage) cannot run here; its result from when the
text was written is shown.

    uv run python scripts/check_texts.py [jenis] [--out report.tsv] [--flag]

--flag writes `recheck: <failed checks>` into each BPK record whose text fails a check other
than invalid_akn, so the next import re-converts exactly those; the field goes when a new text
replaces the old one.
"""

from __future__ import annotations

import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "src"))

from hukum_rapih.checks import run_checks
from hukum_rapih.records import load_record, save_record

DATA = HERE.parent.parent / "data"


def failed_checks(rec: dict, version: dict, text: str) -> dict[str, str]:
    """The checks the text fails: those run now, and those it failed when it was written that
    cannot run without the PDF."""
    checks = run_checks(rec, text, None, version.get("ocr_unknown"))
    written = (version.get("checks") or {}).get("failed", [])
    return {**{f["name"]: f["detail"] for f in written if f["name"] not in checks.passed},
            **checks.failed}


def main(argv: list[str]) -> int:
    jenis = argv[0] if argv and not argv[0].startswith("-") else "uu"
    out = argv[argv.index("--out") + 1] if "--out" in argv else None
    total, rows = 0, []
    for path in sorted((DATA / "peraturan" / jenis).glob("*/*/*.yaml")):
        rec = load_record(path)
        v = next((v for v in rec.get("versions") or [] if v.get("text")), None)
        if v is None:
            continue
        total += 1
        failed = failed_checks(rec, v, (path.parent / v["text"]).read_text())
        written = v.get("checks") or {}
        fixable = "; ".join(f"{name} {detail}" for name, detail in failed.items() if name != "invalid_akn")
        if "--flag" in argv and fixable and rec.get("bpk") and rec.get("recheck") != fixable:
            rec["recheck"] = fixable
            save_record(path, rec)
        if failed:
            src = f"{v.get('pdf_source', '?')} v{v.get('parser_version', '?')}{' ocr' if v.get('ocr') else ''}"
            kept = f"; kept old text: {str(rec['reparse_error'])[:80]}" if rec.get("reparse_error") else ""
            rows.append((rec["id"], src, written.get("word_coverage"), failed, kept))
    rows.sort(key=lambda r: (-len(r[3]), r[2] if r[2] is not None else 1.0))
    lines = [f"{law}\t{src}\t{'-' if cov is None else cov}\t"
             + "; ".join(f"{name} {detail}" for name, detail in failed.items()) + kept
             for law, src, cov, failed, kept in rows]
    print("\n".join(lines))
    print(f"\n{total - len(rows)}/{total} texts pass every check")
    for name, n in Counter(name for row in rows for name in row[3]).most_common():
        print(f"{n:5}  {name}")
    if out:
        Path(out).write_text("\n".join(lines) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
