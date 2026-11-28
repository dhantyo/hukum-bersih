"""Run the PDF parser over the regression set (tests/regression.yaml) and report, per law:
pasal and BAB found vs expected, the share of the PDF's words in the text (`cov`), the OCR
unknown-word rate (`ocr?`) and the self-checks it fails (src/hukum_rapih/checks.py).

    uv run python scripts/regress.py [ids...]

PDFs are downloaded once into ~/.cache/hukum-rapih/pdf (never into the repository): from
archive.org (`url`) or from the Hugging Face mirror of BPK (`hf: [zip, file]`, needs
`remotezip`). Exit status 1 if any count is off.
"""

from __future__ import annotations

import re
import sys
import urllib.request
from pathlib import Path

import yaml

HERE = Path(__file__).resolve().parent
CACHE = Path.home() / ".cache" / "hukum-rapih" / "pdf"
HF = "https://huggingface.co/datasets/Azzindani/ID_REG/resolve/main/"


def pdf_for(law: str, spec: dict) -> Path:
    path = CACHE / f"{law}.pdf"
    if path.exists():
        return path
    CACHE.mkdir(parents=True, exist_ok=True)
    if "url" in spec:
        urllib.request.urlretrieve(spec["url"], path)
    else:
        from remotezip import RemoteZip

        zip_name, member = spec["hf"]
        with RemoteZip(HF + zip_name) as z:
            path.write_bytes(z.read(member))
    return path


def check(law: str, spec: dict) -> tuple[bool, str]:
    sys.path.insert(0, str(HERE.parent / "src"))
    from hukum_rapih.akn.bluebell import to_bluebell
    from hukum_rapih.checks import run_checks, words
    from hukum_rapih.pdf.structure import parse_pdf

    stats: dict = {}
    doc = parse_pdf(pdf_for(law, spec), stats=stats)
    text = to_bluebell(doc)
    jenis, nomor, tahun = law.split("_")
    checks = run_checks({"akn": f"/akn/id/act/{jenis}/{tahun}/{nomor}"}, text,
                        words("\n".join(stats["lines"])),
                        len(doc.ocr_fixes.suspects) if doc.ocr_fixes else None)
    ok = (doc.pasal_count == spec["pasal"] and doc.bab_count == spec["bab"]
          and "invalid_akn" not in checks.failed)
    title = next((b.text for b in doc.blocks if b.kind == "title"), "")
    notes = [f"cov {checks.word_coverage}"]
    if checks.ocr_unknown_rate is not None:
        notes.append(f"ocr? {checks.ocr_unknown_rate}")
    notes += [f"{name} {detail}" for name, detail in checks.failed.items()]
    if re.search(r"\bbahwa\b|PRESIDEN REPUBLIK INDONESIA UNDANG", title):
        notes.append("title polluted")
    if not any(b.kind == "closing" for b in doc.blocks):
        notes.append("no closing")
    else:
        from hukum_rapih.closing import conclusions, parse

        c = parse(conclusions(text))
        missing = [f for f in ("signed.date", "signed.name", "promulgated.date")
                   if not (c.get(f.split(".")[0]) or {}).get(f.split(".")[1])]
        if missing:
            notes.append("closing lacks " + "/".join(missing))
    if spec.get("penjelasan"):
        count = len(re.findall(r"\w+", text.partition("ATTACHMENT Penjelasan")[2]))
        if count < 50:
            notes.append(f"penjelasan missing or empty ({count} words)")
            ok = False
    line = (f"{law:12} pasal {doc.pasal_count:>3}/{spec['pasal']:<3} bab {doc.bab_count:>2}/{spec['bab']:<2} "
            f"{'ok ' if ok else 'OFF'} {', '.join(notes)}")
    return ok, line


def main(argv: list[str]) -> int:
    spec = yaml.safe_load((HERE.parent / "tests" / "regression.yaml").read_text())
    laws = argv or list(spec)
    bad = 0
    for law in laws:
        try:
            ok, line = check(law, spec[law])
        except Exception as e:  # noqa: BLE001
            ok, line = False, f"{law:12} ERROR {type(e).__name__}: {str(e)[:120]}"
        bad += not ok
        print(line, flush=True)
    print(f"{len(laws) - bad}/{len(laws)} with the expected counts")
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
