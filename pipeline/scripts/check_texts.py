"""Check every stored regulation text without its PDF: valid Akoma Ntoso, pasal numbered without
gaps, no page furniture, the closing read into a date, and the Penjelasan's 'Pasal demi pasal'
covering the same pasal as the body (an independent count from the law's other half).

    uv run python scripts/check_texts.py [jenis] [--out report.tsv] [--flag]

--flag writes `recheck: <problems>` into each record with a problem the parser can fix (missed
headings, page furniture, no closing date), so the next import re-converts exactly those; the
field goes when a new text replaces the old one.

Prints one line per law with problems and a summary by kind of problem.
"""

from __future__ import annotations

import re
import sys
from collections import Counter
from itertools import pairwise
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "src"))

from hukum_bersih.records import load_record, save_record

DATA = HERE.parent.parent / "data"
LEAKS = {
    "page-turn": re.compile(r"[^.\s]\s*(?:…|\.\s?\.\s?\.)\.?\s*$", re.MULTILINE),
    "page no.": re.compile(r"(?:^|\s)-\s*\d{1,3}\s*-(?:\s|$)", re.MULTILINE),
    "watermark": re.compile(r"depkumham|peraturan\.go\.id|jdih\.", re.IGNORECASE),
    "SK No": re.compile(r"\bSK\s*No\b"),
    "browser": re.compile(r"\d{1,2}:\d{2}\s*[AP]M\b|https?://"),
}
ART = re.compile(r"^ *ART ([0-9]+[A-Z]?|[IVXLC]+) -", re.MULTILINE)


def number(label: str) -> int | None:
    m = re.fullmatch(r"(\d+)", label)
    return int(m[1]) if m else None


def check(rec: dict, text: str) -> list[str]:
    sys.path.insert(0, str(HERE.parent / "src"))
    from hukum_bersih.akn.build import to_akn
    from hukum_bersih.closing import conclusions, parse

    problems = []
    try:
        to_akn(text, rec["akn"], "act")
    except Exception as e:  # noqa: BLE001
        problems.append(f"invalid AKN: {type(e).__name__}")
    body = text.partition("ATTACHMENT")[0]
    penj = text.partition("ATTACHMENT Penjelasan")[2].split("\nATTACHMENT ")[0]
    arts = ART.findall(body)
    nums = [number(a) for a in arts]
    if not arts:
        problems.append("no pasal")
    elif all(n is not None for n in nums):           # Arabic: 1, 2, 3 … (inserted 5A are skipped)
        gaps = [f"{a}->{b}" for a, b in pairwise(nums) if b != a + 1]
        if nums[0] != 1 or gaps:
            problems.append("pasal sequence " + (f"starts {nums[0]} " if nums[0] != 1 else "") + " ".join(gaps[:3]))
    # a heading the parser missed shows as "Pasal N" glued into the text after a sentence:
    # "… Cukup jelas. Pasal 5: Cukup jelas." (UU 147/2024), "… perundang-undangan. ' Pasal 8 Pada"
    glued = re.compile(r"[.;:]\W{0,3}\s+Pasal \d+[A-Z]?\s*[:.]?\s+(?:Cukup jelas|[A-Z(])")
    amending = bool(arts) and bool(re.fullmatch(r"[IVXLC]+", arts[0]))   # quoted pasal stay in Pasal I
    for part, where in (() if amending else ((body, "body"), (penj, "penjelasan"))):
        # not: a reference in the Mengingat list or a list item ("d. Pasal 89 Undang-undang Dasar"),
        # or to another law ("Pasal 33 Undang-Undang Dasar 1945")
        hits = [m for m in glued.finditer(part)
                if not re.search(r"Mengingat|POINT|ITEM", part[max(0, m.start() - 14):m.start() + 1])
                and not re.match(r"\s*(?:Undang|UUD|ayat|huruf)", part[m.end() - 1:], re.IGNORECASE)]
        if n := len(hits):
            problems.append(f"missed heading in {where} {n}")
    for name, rx in LEAKS.items():
        if n := len(rx.findall(body)):
            problems.append(f"{name} {n}")
    c = parse(conclusions(text))
    if not (c.get("signed") or {}).get("date"):
        problems.append("closing: no date of signing")
    return problems


def main(argv: list[str]) -> int:
    jenis = argv[0] if argv and not argv[0].startswith("-") else "uu"
    out = argv[argv.index("--out") + 1] if "--out" in argv else None
    kinds, bad, total, rows = Counter(), 0, 0, []
    for path in sorted((DATA / "peraturan" / jenis).glob("*/*/*.yaml")):
        rec = load_record(path)
        texts = [v for v in rec.get("versions") or [] if v.get("text")]
        if not texts:
            continue
        total += 1
        v = texts[0]
        problems = check(rec, (path.parent / v["text"]).read_text())
        if rec.get("reparse_error"):
            problems.append("kept old text: " + str(rec["reparse_error"])[:80])
        fixable = [p for p in problems if not p.startswith(("kept old text", "invalid AKN"))]
        if "--flag" in argv and fixable and rec.get("bpk") and rec.get("recheck") != "; ".join(fixable):
            rec["recheck"] = "; ".join(fixable)
            save_record(path, rec)
        if problems:
            bad += 1
            for p in problems:
                kinds[re.sub(r"\d+", "N", p.split(":")[0])] += 1
            src = f"{v.get('pdf_source', '?')} v{v.get('parser_version', '?')}{' ocr' if v.get('ocr') else ''}"
            rows.append(f"{rec['id']}\t{src}\t{'; '.join(problems)}")
            print(f"{rec['id']:14} {src:28} {'; '.join(problems)}", flush=True)
    print(f"\n{total - bad}/{total} texts without problems")
    for k, n in kinds.most_common():
        print(f"{n:5}  {k}")
    if out:
        Path(out).write_text("\n".join(rows) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
