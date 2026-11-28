"""Check the merged text of the UUD 1945 against the MPR's consolidated text (decision 0027).

    uv run python scripts/check_uud.py <satu-naskah.txt> [--out report.md]

The latest merged version is built the way the website builds it (``corpus/merge.py``), from
the 1945 text and the amendments' pasal changes. The consolidated text is BPK's
``UUD45_SatuNaskah.pdf`` parsed by ``hukum-rapih import-bpk uud --check-dir``; it is never
stored. Prints the measured difference pasal by pasal; a difference does not fail the run.
"""

from __future__ import annotations

import argparse
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "src"))

from hukum_rapih.akn.build import to_akn_tree
from hukum_rapih.corpus.laws import Laws
from hukum_rapih.corpus.merge import merged_doc
from hukum_rapih.corpus.reader_text import Document, Node, read_document

DATA = HERE.parent.parent / "data"
UUD = "uud_1945"


# The consolidated text marks each pasal with the amendment that made it ("*)" .. "****)") and
# breaks lines with soft hyphens ("Undang­Undang"); neither is wording.
AMENDMENT_MARK = re.compile(r"\*{1,4}\)")


def _words(node: Node) -> list[str]:
    own = " ".join(str(node[k]) for k in ("num", "text") if node.get(k))
    own = AMENDMENT_MARK.sub(" ", own.replace("­", "-"))
    return own.split() + [w for child in node["children"] for w in _words(child)]


def articles(nodes: list[Node], found: dict[str, str]) -> dict[str, str]:
    """Pasal number -> its wording as one line (the heading's number left out)."""
    for node in nodes:
        if node["tag"] == "article":
            found[node.get("num") or "?"] = " ".join(
                w for child in node["children"] for w in _words(child))
        else:
            articles(node["children"], found)
    return found


def _key(num: str) -> tuple[int, str]:
    m = re.match(r"(\d+)(.*)", num)
    return (int(m[1]), m[2]) if m else (10**6, num)


def compare(merged: dict[str, str], consolidated: dict[str, str]) -> list[str]:
    """The report's lines (Markdown)."""
    same = [n for n in consolidated if merged.get(n) == consolidated[n]]
    differ = [n for n in consolidated if n in merged and merged[n] != consolidated[n]]
    only_c = [n for n in consolidated if n not in merged]
    only_m = [n for n in merged if n not in consolidated]
    whole = SequenceMatcher(None, " ".join(merged[n] for n in sorted(merged, key=_key)).split(),
                            " ".join(consolidated[n] for n in sorted(consolidated, key=_key)).split(),
                            autojunk=False).ratio()
    lines = [f"- Pasal in the consolidated text: {len(consolidated)}; in the merged text: {len(merged)}",
             f"- Same wording: {len(same)}; different wording: {len(differ)}",
             f"- Only in the consolidated text: {', '.join(only_c) or 'none'}",
             f"- Only in the merged text: {', '.join(only_m) or 'none'}",
             f"- Words in common, whole body: {whole:.1%}"]
    if differ:
        lines += ["", "| Pasal | Words in common | Merged | Consolidated |", "|---|---|---|---|"]
        for n in sorted(differ, key=_key):
            ratio = SequenceMatcher(None, merged[n].split(), consolidated[n].split(), autojunk=False).ratio()
            lines.append(f"| {n} | {ratio:.0%} | {merged[n][:90]} | {consolidated[n][:90]} |")
    return lines


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("satu_naskah", type=Path)
    ap.add_argument("--out", type=Path)
    args = ap.parse_args()

    laws = Laws(DATA, types=None)
    base = laws.regulations.get(UUD)
    koleksi = laws.collections.of(UUD)
    if base is None or not base.has_text or koleksi is None or not base.history:
        print(f"{UUD}: no text or no amendments in data/; nothing to check")
        return 1
    original = read_document(to_akn_tree((base.folder / base.text_version["text"]).read_text(), base.akn))
    point = base.history["points"][-1]
    merged = merged_doc(laws, koleksi, point["id"], original)
    consolidated: Document = read_document(to_akn_tree(args.satu_naskah.read_text(), base.akn))
    lines = [f"## UUD 1945: merged {point['id']} against UUD45_SatuNaskah.pdf", "",
             (f"- Merged point complete by its own count: {point.get('complete')}"
              f" (pasal not read: {', '.join(merged.unreadable) if merged else 'all'})"),
             *compare(articles(merged.document.body, {}) if merged else {},
                      articles(consolidated.body, {}))]
    report = "\n".join(lines) + "\n"
    print(report)
    if args.out:
        args.out.write_text(report)
    return 0


if __name__ == "__main__":
    sys.exit(main())
