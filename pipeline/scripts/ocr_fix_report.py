"""What the OCR spell fix (pdf/ocr_fix.py) changes on a random sample of scanned UU, for a
person to judge: every corrected word with its line before and after, and the words left as
read. Read-only: nothing in data/ is written.

    uv run python scripts/ocr_fix_report.py [N] [seed]

PDFs are versions marked ``ocr`` whose file is on archive.org (manifest) or in the Hugging Face
mirror of BPK; downloaded once into ~/.cache/hukum-rapih/pdf (never into the repository).
Prints Markdown (the workflow appends it to the job summary).
"""

from __future__ import annotations

import json
import random
import sys
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = HERE.parent.parent / "data"
CACHE = Path.home() / ".cache" / "hukum-rapih" / "pdf"
HF = "https://huggingface.co/datasets/Azzindani/ID_REG/resolve/main/"
sys.path.insert(0, str(HERE.parent / "src"))

from hukum_rapih.pdf import extract, ocr_fix
from hukum_rapih.pdf.structure import parse_pdf
from hukum_rapih.records import load_record


def scanned_versions() -> list[tuple[str, str]]:
    """(version id, source) of every OCR'd UU text whose PDF we can get without BPK."""
    archived = {}
    for f in (DATA / "sources" / "manifests").glob("*.jsonl"):
        for line in f.open():
            r = json.loads(line)
            if r.get("archive_url"):
                archived[r["sha256"]] = r["archive_url"]
    mirror = json.loads((DATA / "sources" / "mirrors" / "id_reg.json").read_text())["files"]
    out = []
    for path in sorted((DATA / "peraturan" / "uu").glob("*/*/*.yaml")):
        rec = load_record(path)
        for v in rec.get("versions") or []:
            if not v.get("ocr"):
                continue
            if v.get("pdf_sha256") in archived:
                out.append((v["id"], archived[v["pdf_sha256"]]))
                continue
            name = urllib.parse.unquote((rec.get("source_pdf_url") or "").rsplit("/", 1)[-1]).replace(" ", "_")
            if name in mirror:
                out.append((v["id"], f"hf:{mirror[name][0]}:{name}"))
    return out


def pdf_for(version: str, source: str) -> Path:
    path = CACHE / f"{version}.pdf"
    if not path.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        if source.startswith("hf:"):
            from remotezip import RemoteZip

            _, zip_name, member = source.split(":", 2)
            with RemoteZip(HF + zip_name) as z:
                path.write_bytes(z.read(member))
        else:
            urllib.request.urlretrieve(source, path)
    return path


def main() -> None:
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    seed = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    pool = scanned_versions()
    sample = random.Random(seed).sample(pool, min(n, len(pool)))

    changed_lines: list[tuple[str, str, str]] = []
    current = [""]
    real_fix = extract.fix_lines

    def spy(lines):                     # keep each changed line, before and after
        out, fixes = real_fix(lines)
        changed_lines.extend((current[0], a, b) for a, b in zip(lines, out) if a != b)
        return out, fixes

    extract.fix_lines = spy
    unknown: Counter[str] = Counter()
    words = corrected = 0
    checker = "?"
    print(f"## OCR spell fix: {len(sample)} random scanned UU (of {len(pool)}), seed {seed}\n")
    print("| law | pages OCR'd | pasal | words | corrected | unknown |\n|---|---|---|---|---|---|")
    for version, source in sample:
        current[0] = version
        try:
            doc = parse_pdf(pdf_for(version, source))
        except Exception as e:  # noqa: BLE001 - report and go on
            print(f"| {version} | failed: {type(e).__name__}: {str(e)[:80]} | | | | |")
            continue
        f = doc.ocr_fixes or ocr_fix.Fixes()
        checker = f.checker if doc.ocr_fixes else checker
        n_words = sum(len(b.text.split()) for b in doc.blocks)
        pages = next((w.split()[1] for w in doc.warnings if w.startswith("ocr:")), "0")
        words += n_words
        corrected += len(f.changed)
        unknown.update(f.suspects)
        print(f"| {version} | {pages} | {doc.pasal_count} | {n_words} | {len(f.changed)} | {len(f.suspects)} |")

    print(f"\n**{corrected} words corrected in {words} words; {sum(unknown.values())} unknown words "
          f"({len(unknown)} distinct) left as read. Spell checker: {checker}.**\n")
    print("### Every correction (line before / after)\n")
    for version, before, after in changed_lines:
        print(f"- `{version}`\n  - was: {before}\n  - now: {after}")
    print("\n### Unknown words left as read (most frequent first)\n")
    print(", ".join(f"{w} ({c})" for w, c in unknown.most_common(300)))


if __name__ == "__main__":
    main()
