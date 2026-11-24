"""Check the parser on a random sample of UU from the Hugging Face mirror of BPK, without
hand-made expectations: every law must give valid Akoma Ntoso, the pasal count must match an
independent count of "Pasal N" headings in the raw text, no page furniture may leak, the
closing must read into fields, and a Penjelasan in the PDF must be found.

    uv run python scripts/survey.py N [seed]      (needs remotezip; PDFs cached outside git)

The mirror's file list is built once (HTTP range requests, ~5 min) into the cache.
"""

from __future__ import annotations

import json
import random
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
CACHE = Path.home() / ".cache" / "hukum-bersih"
HF = "https://huggingface.co/datasets/Azzindani/ID_REG/resolve/main/"
UU_NAME = re.compile(r"^UU_Nomor_(\d+)_Tahun_(\d{4})\.pdf$", re.IGNORECASE)


def index() -> dict[str, tuple[str, str]]:
    """law id -> (zip, member) for files named like BPK's 'UU Nomor 4 Tahun 2009.pdf'."""
    path = CACHE / "id_reg_uu.json"
    if not path.exists():
        from huggingface_hub import HfApi
        from remotezip import RemoteZip

        out = {}
        zips = [f for f in HfApi().list_repo_files("Azzindani/ID_REG", repo_type="dataset") if f.endswith(".zip")]
        for z in zips:
            with RemoteZip(HF + z) as rz:
                for info in rz.infolist():
                    if m := UU_NAME.match(info.filename):
                        out[f"uu_{int(m[1])}_{m[2]}"] = (z, info.filename)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(out))
    return {k: tuple(v) for k, v in json.loads(path.read_text()).items()}


def pdf(law: str, where: tuple[str, str]) -> Path:
    p = CACHE / "pdf" / f"{law}.pdf"
    if not p.exists():
        from remotezip import RemoteZip

        p.parent.mkdir(parents=True, exist_ok=True)
        with RemoteZip(HF + where[0]) as rz:
            p.write_bytes(rz.read(where[1]))
    return p


def independent_count(lines: list[str]) -> tuple[int, bool]:
    """Sequential 'Pasal N' headings before the closing, and whether a Penjelasan exists."""
    end = next((i for i, ln in enumerate(lines)
                if re.match(r"^(Disahkan|Ditetapkan|Dikeluarkan) di|^Agar (supaya )?setiap orang", ln)), len(lines))
    seq, roman_seen, quoted_one = 0, False, False
    for ln in lines[:end]:
        m = re.match(r"^(?:Pasal|PASAL)\s*(\d+|[IVX]+)\s*\.?$", ln)
        if not m:
            continue
        v = int(m[1]) if m[1].isdigit() else {"I": 1, "II": 2, "III": 3, "IV": 4, "V": 5}.get(m[1], 0)
        roman_seen |= not m[1].isdigit() and v == 1 and seq == 0
        quoted_one = quoted_one or (roman_seen and m[1] == "1")
        if roman_seen and m[1] == "2" and seq == 1 and not quoted_one:
            roman_seen = False                # "Pasal I." misprinted for Pasal 1 (UU 16/1953)
        if roman_seen and m[1].isdigit():
            continue                          # quoted pasal inside an amending law's Pasal I
        if v == seq + 1:
            seq = v
    has_penj = any(re.match(r"^(MEMORI\s+)?PEND?JELASAN\b", ln) for ln in lines[end:])
    return seq, has_penj


def check(law: str, path: Path) -> list[str]:
    sys.path.insert(0, str(HERE.parent / "src"))
    from hukum_bersih.akn.bluebell import to_bluebell
    from hukum_bersih.akn.build import to_akn
    from hukum_bersih.closing import conclusions, parse
    from hukum_bersih.pdf.extract import clean_lines, page_lines
    from hukum_bersih.pdf.structure import parse_lines

    stats: dict = {}
    lines = clean_lines(page_lines(path, stats), stats)
    doc = parse_lines(lines)
    text = to_bluebell(doc)
    problems = []
    want, has_penj = independent_count(lines)
    if doc.pasal_count != want:
        problems.append(f"pasal {doc.pasal_count} vs {want} headings")
    if doc.pasal_count == 0:
        problems.append("no pasal")
    jenis, nomor, tahun = law.split("_")
    try:
        to_akn(text, f"/akn/id/act/{jenis}/{tahun}/{nomor}", "act")
    except Exception as e:  # noqa: BLE001
        problems.append(f"invalid AKN: {type(e).__name__}")
    body = text.split("ATTACHMENT")[0]
    for name, rx in (("page-turn", r"[^.\s]\s*(?:…|\.\s?\.\s?\.)\.?\s*$"), ("page no.", r"(?:^|\s)-\s*\d{1,3}\s*-(?:\s|$)"),
                     ("watermark", r"depkumham|peraturan\.go\.id"), ("SK No", r"\bSK\s*No\b"),
                     ("browser", r"\d{1,2}:\d{2}\s*[AP]M\b|https?://")):
        if n := len(re.findall(rx, body, re.MULTILINE | re.IGNORECASE)):
            problems.append(f"{name} {n}")
    c = parse(conclusions(text))
    if not (c.get("signed") or {}).get("date"):
        problems.append("closing: no date of signing")   # a missing signer can be the copy's (UU 10/2006)
    if has_penj and not any(b.kind == "penjelasan" for b in doc.blocks):
        problems.append("penjelasan missed")
    return problems


def main(argv: list[str]) -> int:
    n = int(argv[0]) if argv else 50
    seed = int(argv[1]) if len(argv) > 1 else 20261121
    idx = index()
    laws = random.Random(seed).sample(sorted(idx), min(n, len(idx)))
    bad = 0
    for law in sorted(laws, key=lambda x: int(x.split("_")[2])):
        try:
            problems = check(law, pdf(law, idx[law]))
        except Exception as e:  # noqa: BLE001
            problems = [f"ERROR {type(e).__name__}: {str(e)[:100]}"]
        bad += bool(problems)
        print(f"{law:12} {'ok' if not problems else '; '.join(problems)}", flush=True)
    print(f"{len(laws) - bad}/{len(laws)} without problems ({len(idx)} UU in the mirror)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
