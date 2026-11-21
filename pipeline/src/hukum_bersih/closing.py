"""The closing of a law (Penutup) as fields, for the Modern view: the order to promulgate,
who signed and promulgated it where and when, co-signing ministers, and the Lembaran Negara.

The stored text keeps the closing line by line as printed (CONCLUSIONS); this module only
reads it. Layouts handled, as found in the BPK sample (docs/parser-review-2026-11.md):

    1947   Ditetapkan di Yogyakarta / pada tanggal 30 Agustus 1947. / PRESIDEN REPUBLIK
           INDONESIA, / SOEKARNO. / Menteri Keuangan, / A.A. MARAMIS. / Diumumkan pada tanggal
           30 Agustus 1947. / Sekretaris Negara, / A.G. PRINGGODIGDO.
    1956   Disahkan di Jakarta / … / Presiden Republik Indonesia. / ttd. / SOEKARNO. / Menteri
           Dalam Negeri, / ttd. / SUNARJO / Diundangkan / pada tanggal … / Menteri Kehakiman, / …
           / LEMBARAN NEGARA NOMOR 65 TAHUN 1956
    2009+  Agar setiap orang … / Disahkan di Jakarta / pada tanggal … / PRESIDEN REPUBLIK
           INDONESIA, / ttd. / NAME / Diundangkan di Jakarta / … / MENTERI … / REPUBLIK INDONESIA, /
           ttd. / NAME / LEMBARAN NEGARA REPUBLIK INDONESIA TAHUN 2009 NOMOR 4
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import yaml

ORDER_RE = re.compile(r"^Agar (?:supaya )?setiap orang", re.IGNORECASE)
SIGNED_RE = re.compile(r"^(Disahkan|Disjahkan|Ditetapkan|Dikeluarkan)(?: di (?P<place>.+?))?[.,]?$", re.IGNORECASE)
PROMULGATED_RE = re.compile(r"^(Diundangkan|Diumumkan)(?: di (?P<place>.+?))?(?: pada tanggal (?P<date>.+?))?[.,]?$", re.IGNORECASE)
DATE_RE = re.compile(r"^pada tanggal (?P<date>.+?)\.?$", re.IGNORECASE)
OLD_PLACE_DATE_RE = re.compile(r"^(?P<place>D[j]?akarta|Jogjakarta|Yogyakarta),? (?:pada )?tanggal (?P<date>.+?)\.?$", re.IGNORECASE)
LN_RE = re.compile(r"^LEMBARAN NEGARA(?: REPUBLIK INDONESIA)?(?: TAHUN (?P<y1>\d{4}))? NOMOR (?P<n>\d+)(?: TAHUN (?P<y2>\d{4}))?", re.IGNORECASE)
TTD_RE = re.compile(r"^t\.?t\.?d\.?$", re.IGNORECASE)
# the second line of an office ("MENTERI HUKUM DAN HAK ASASI MANUSIA" / "REPUBLIK INDONESIA,")
CONTINUES_RE = re.compile(r"^(REPUBLIK|Republik|INDONESIA|Indonesia|DAN|dan|NEGARA|Negara)\b")


def parse(lines: list[str]) -> dict:
    """Closing lines as printed -> {"order", "signed", "promulgated", "lembaran_negara"}.
    ``signed`` / ``promulgated``: {place, date, office, name, cosigners: [{office, name}]}.
    Fields not found are left out; nothing is invented."""
    out: dict = {}
    block: dict | None = None
    office: list[str] = []

    def person(name: str) -> None:
        nonlocal office
        if block is None:
            return
        who = {"office": " ".join(office).rstrip(",.") or None, "name": name.rstrip(".")}
        if "name" not in block:
            block.update({k: v for k, v in who.items() if v})
        else:
            block.setdefault("cosigners", []).append({k: v for k, v in who.items() if v})
        office = []

    for line in (ln.strip() for ln in lines if ln.strip()):
        if ORDER_RE.match(line):
            out["order"] = line
        elif m := LN_RE.match(line):
            out["lembaran_negara"] = {"tahun": int(m["y1"] or m["y2"]) if (m["y1"] or m["y2"]) else None,
                                      "nomor": int(m["n"])}
        elif m := PROMULGATED_RE.match(line):
            block = out.setdefault("promulgated", {})
            office = []
            if m["place"]:
                block["place"] = m["place"]
            if m["date"]:
                block["date"] = m["date"]
        elif m := SIGNED_RE.match(line):
            if "name" in out.get("signed", {}) and "promulgated" not in out:
                # a second "Disahkan" block is the promulgation, misprinted (UU 31/1999)
                block = out["promulgated"] = {"note": f"printed as '{line}'"}
            else:
                block = out.setdefault("signed", {})
            office = []
            if m["place"]:
                block["place"] = m["place"]
        elif m := OLD_PLACE_DATE_RE.match(line):
            block = out.setdefault("signed", {})
            block.update(place=m["place"], date=m["date"])
        elif (m := DATE_RE.match(line)) and block is not None:
            block["date"] = m["date"]
        elif TTD_RE.match(line):
            if office and not office[-1].endswith((",", ".")):
                office[-1] += ","                # "ttd." ends an office printed without a comma
            continue
        elif block is not None:
            if office and not office[-1].endswith((",", ".")) and CONTINUES_RE.match(line):
                office.append(line)              # an office over two lines ("… MANUSIA" / "REPUBLIK INDONESIA,")
            elif not office and (line.endswith(",") or _is_office(line)):
                office = [line]                  # "PRESIDEN REPUBLIK INDONESIA,", "Presiden Republik Indonesia."
            else:
                person(line)                     # the line after a complete office is the name
    return out


def _is_office(text: str) -> bool:
    return bool(re.match(r"^(PRESIDEN|Presiden|MENTERI|Menteri|SEKRETARIS|Sekretaris|WAKIL|Wakil)\b", text))


def conclusions(bluebell: str) -> list[str]:
    """The CONCLUSIONS paragraphs of a stored text, one per printed line."""
    m = re.search(r"^CONCLUSIONS\n(.*?)(?=^\S|\Z)", bluebell, re.MULTILINE | re.DOTALL)
    if not m:
        return []
    return [ln.strip() for ln in m[1].splitlines() if ln.strip()]


def build(data_dir: Path, out_dir: Path) -> int:
    """``out_dir/closing/<version id>.json`` for every regulation text with a closing
    (for the website; regenerated, not committed)."""
    target = out_dir / "closing"
    target.mkdir(parents=True, exist_ok=True)
    count = 0
    for path in sorted((data_dir / "peraturan").glob("*/*/*/*.yaml")):
        rec = yaml.safe_load(path.read_text())
        for v in rec.get("versions") or []:
            if not v.get("text"):
                continue
            lines = conclusions((path.parent / v["text"]).read_text())
            if not lines:
                continue
            (target / f"{v['id']}.json").write_text(json.dumps(
                {"id": v["id"], "lines": lines, **parse(lines)}, ensure_ascii=False))
            count += 1
    return count
