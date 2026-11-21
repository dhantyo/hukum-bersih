"""Run the PDF parser over the regression set (tests/regression.yaml) and report, per law:
pasal and BAB found vs expected, and leaks of page furniture into the text.

    uv run python scripts/regress.py [ids...]

PDFs are downloaded once into ~/.cache/hukum-bersih/pdf (never into the repository): from
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
CACHE = Path.home() / ".cache" / "hukum-bersih" / "pdf"
HF = "https://huggingface.co/datasets/Azzindani/ID_REG/resolve/main/"

LEAKS = {
    "page-turn": re.compile(r"(?:…|\.\s?\.\s?\.)\s*$", re.M),
    "page no.": re.compile(r"(?:^|\s)-\s*\d{1,3}\s*-(?:\s|$)", re.M),
    "watermark": re.compile(r"depkumham|peraturan\.go\.id|jdih\.", re.I),
    "SK No": re.compile(r"\bSK\s*No\b"),
}


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
    from hukum_bersih.akn.bluebell import to_bluebell
    from hukum_bersih.pdf.structure import parse_pdf

    doc = parse_pdf(pdf_for(law, spec))
    text = to_bluebell(doc)
    body = text.split("ATTACHMENT")[0]
    ok = doc.pasal_count == spec["pasal"] and doc.bab_count == spec["bab"]
    leaks = {k: len(rx.findall(body)) for k, rx in LEAKS.items()}
    title = next((b.text for b in doc.blocks if b.kind == "title"), "")
    notes = [f"{k} {n}" for k, n in leaks.items() if n]
    if re.search(r"\bbahwa\b|PRESIDEN REPUBLIK INDONESIA UNDANG", title):
        notes.append("title polluted")
    if not any(b.kind == "closing" for b in doc.blocks):
        notes.append("no closing")
    if spec.get("penjelasan") and not any(b.kind == "penjelasan" for b in doc.blocks):
        notes.append("no penjelasan")
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
