"""Count, per decade, the stored UU texts that show each drafting feature (the table in
docs/uu-grammar.md, "Laws before 2004").

    uv run python scripts/uu_features.py [data/peraturan/uu]
"""

from __future__ import annotations

import re
import sys
from collections import defaultdict
from pathlib import Path

FEATURES = {
    "penjelasan": re.compile(r"^ATTACHMENT Penjelasan", re.MULTILINE),
    "umum": re.compile(r"^\s*PART I - UMUM", re.MULTILINE),
    "tln_line": re.compile(r"^\s*TAMBAHAN LEMBARAN NEGARA(?: REPUBLIK INDONESIA)? (?:TAHUN \d{4} )?"
                           r"NOMOR \d+", re.MULTILINE),
    "persetujuan_bersama": re.compile(r"Dengan Persetujuan Bersama", re.IGNORECASE),
    "pasal_I": re.compile(r"^\s*ART I -", re.MULTILINE),
}


def main() -> None:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else "../data/peraturan/uu")
    counts: dict[int, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for txt in root.glob("*/*/*.txt"):
        decade = int(txt.parent.parent.name) // 10 * 10
        text = txt.read_text()
        counts[decade]["uu"] += 1
        for name, rx in FEATURES.items():
            counts[decade][name] += bool(rx.search(text))
    names = ["uu", *FEATURES]
    print("decade " + " ".join(f"{n:>20}" for n in names))
    for decade in sorted(counts):
        print(f"{decade}s  " + " ".join(f"{counts[decade][n]:>20}" for n in names))


if __name__ == "__main__":
    main()
