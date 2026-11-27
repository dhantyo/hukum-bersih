"""Relationships between regulations: which law amends, revokes or enacts which.

Two sources, both already in data/ (no download needed):

1. Titles ("tentang"): "PERUBAHAN KEDUA ATAS UNDANG-UNDANG NOMOR 11 TAHUN 2008 ...",
   "MENGUBAH DAN MENAMBAH UNDANG-UNDANG NO. 12 TAHUN 1956", "PENCABUTAN UNDANG-UNDANG ...",
   "PENETAPAN PERATURAN PEMERINTAH PENGGANTI UNDANG-UNDANG NOMOR 2 TAHUN 2022 ... MENJADI
   UNDANG-UNDANG".
2. The amending law's own text, which states what it changes: "Ketentuan ayat (3) Pasal 31
   diubah", "disisipkan 2 (dua) pasal, yakni Pasal 45A dan Pasal 45B", "Pasal 9 dihapus".

Written into each record's ``relationships``: the amending law gets ``amends`` (with the pasal it
changes), ``revokes`` and ``enacts``; the target gets ``amended_by`` / ``revoked_by`` /
``enacted_by``. Recomputed from scratch on every run, so it is idempotent.
"""

from __future__ import annotations

import re
from pathlib import Path

from .records import load_record, save_record

ORDINAL = {"KEDUA": 2, "KETIGA": 3, "KEEMPAT": 4, "KELIMA": 5, "KEENAM": 6, "KETUJUH": 7,
           "KEDELAPAN": 8, "KESEMBILAN": 9, "KESEPULUH": 10}

# A citation of a law: "UNDANG-UNDANG NOMOR 11 TAHUN 2008", "UNDANG-UNDANG NO. 12 TAHUN 1956",
# "UNDANG-UNDANG NOMOR 7 DRT TAHUN 1956", "UNDANG-UNDANG DARURAT NO. 3 TAHUN 1953",
# "PERATURAN PEMERINTAH PENGGANTI UNDANG-UNDANG NOMOR 2 TAHUN 2022".
CITE = (r"(?P<kind>PERATURAN\s+PEMERINTAH\s+PENGGANTI\s+UNDANG[\s-]*UNDANG|UNDANG[\s-]*UNDANG"
        r"(?:\s+DARURAT)?)(?:\s+REPUBLIK\s+INDONESIA)?\s+(?:NOMOR|NO\.?)\s*(?P<num>\d+[A-Z]?)"
        r"(?P<drt>\s*DRT\.?)?\s*,?\s*TAHUN\s*(?P<year>\d{4})")
AMEND_RE = re.compile(
    r"(?:PERUBAHAN(?:\s+(?P<ord>KEDUA|KETIGA|KEEMPAT|KELIMA|KEENAM|KETUJUH|KEDELAPAN|KESEMBILAN"
    r"|KESEPULUH))?(?:\s+ATAS|\s+DAN\s+(?:PENYEMPURNAAN|TAMBAHAN)(?:\s+ATAS)?)?|MENGUBAH"
    r"(?:\s+DAN\s+MENAMBAH)?|MERUBAH)\s+(?:BEBERAPA\s+(?:PASAL|KETENTUAN)\s+(?:DALAM|DARI)\s+)?"
    + CITE)
REVOKE_RE = re.compile(r"(?:PENCABUTAN|MENCABUT)\s+" + CITE)
ENACT_RE = re.compile(r"^PENETAPAN\s+\"?" + CITE + r".*?(?:MENJADI|SEBAGAI)\s+UNDANG[\s-]*UNDANG",
                      re.DOTALL)

# Amendment instructions in the amending law's text.
CHANGED_RE = re.compile(r"Ketentuan\s+(.{0,240}?)\s+diubah", re.DOTALL)
BETWEEN_RE = re.compile(r"Di\s+antara\s+(.{0,160}?)\s+disisipkan", re.DOTALL)
INSERTED_RE = re.compile(r"disisipkan\s+\S+\s+\(\w+\)\s+pasal,?\s+(?:yakni|yaitu)\s+(.{0,240}?)"
                         r"(?:\s+sehingga|\s+yang\s+berbunyi|\s+berbunyi|[.;:]|$)", re.DOTALL)
# "Pasal" and its number as found in OCR'd text layers ("Pasil 27A", "Pasal 4O", "Pasal l3").
# Only the extracted *numbers* are normalised; the stored text is never changed.
NUM = r"([0-9][0-9OIl]*[A-Z]{0,2})"
DELETED_RE = re.compile(r"Pas[ai]l\s+" + NUM + r"\s+dihapus")
PASAL_RE = re.compile(r"Pas[ai]l\s+" + NUM + r"\b")


def _num(raw: str) -> str:
    """Pasal number with OCR digit misreads fixed: 4O -> 40, l3 -> 13 (letter suffix kept)."""
    raw = re.sub(r"El$", "B", raw)            # "27El" is how one OCR layer reads "27B"
    m = re.match(r"([0-9OIlS]+)([A-Z]{0,2})$", raw)
    if not m or not re.search(r"\d", m[1]):
        return raw
    digits = m[1].replace("O", "0").replace("I", "1").replace("l", "1").replace("S", "5")
    return digits + m[2]


def _sequence(nums: list[str]) -> list[str]:
    """Inserted pasal follow each other (16A, 16B): read '168' after '16A' as '16B'."""
    out: list[str] = []
    for n in nums:
        prev = out[-1] if out else ""
        m = re.match(r"(\d+)([A-Z])$", prev)
        if m and n == m[1] + "8" and m[2] == "A":
            n = m[1] + "B"
        out.append(n)
    return out


def cite_id(m: re.Match) -> str:
    kind = re.sub(r"[\s-]+", " ", m["kind"])
    if kind.startswith("PERATURAN"):
        jenis = "perppu"
    elif "DARURAT" in kind or m["drt"]:
        jenis = "uu-drt"
    else:
        jenis = "uu"
    return f"{jenis}_{m['num'].lower()}_{m['year']}"


def from_title(tentang: str) -> dict:
    """Relations named in a title."""
    t = re.sub(r"\s+", " ", (tentang or "").upper())
    out: dict = {"amends": [], "revokes": [], "enacts": []}
    seen = set()
    if (m := ENACT_RE.search(t)):
        out["enacts"].append(cite_id(m))
        seen.add(cite_id(m))
    for m in AMEND_RE.finditer(t):
        target = cite_id(m)
        if target in seen:
            continue
        seen.add(target)
        entry = {"id": target}
        if m["ord"]:
            entry["order"] = ORDINAL[m["ord"]]
        out["amends"].append(entry)
    for m in REVOKE_RE.finditer(t):
        if cite_id(m) not in seen:
            out["revokes"].append(cite_id(m))
    return out


def _natural(p: str) -> tuple[int, str]:
    m = re.match(r"(\d+)(.*)", p)
    return (int(m[1]), m[2]) if m else (10**6, p)


def changes_in_text(text: str) -> dict[str, list[str]]:
    """Pasal changed / inserted / deleted, from an amending law's own text (body only)."""
    body = text.split("ATTACHMENT Penjelasan")[0]
    body = re.sub(r"\\(.)", r"\1", re.sub(r"\s+", " ", body))   # unescape Bluebell, one line
    changed, inserted, deleted = set(), set(), set()
    for m in CHANGED_RE.finditer(body):
        changed.update(_num(n) for n in PASAL_RE.findall(m[1]))
    for m in BETWEEN_RE.finditer(body):
        seg = m[1]
        if re.match(r"\s*Pas[ai]l\s+\S+\s+dan\s+Pas[ai]l", seg):
            continue          # "Di antara Pasal 45 dan Pasal 46 disisipkan ... pasal": insertion
        changed.update(_num(n) for n in PASAL_RE.findall(seg))
    for m in INSERTED_RE.finditer(body):
        inserted.update(_sequence([_num(n) for n in PASAL_RE.findall(m[1])]))
    deleted.update(_num(n) for n in DELETED_RE.findall(body))
    changed -= inserted | deleted
    out = {"diubah": sorted(changed, key=_natural), "disisipkan": sorted(inserted, key=_natural),
           "dihapus": sorted(deleted, key=_natural)}
    return {k: v for k, v in out.items() if v}


def _pasal_numbers(rec: dict, folder: Path) -> set[str]:
    """Pasal numbers of a law's own text (empty if it has none)."""
    for v in rec.get("versions") or []:
        if v.get("text") and (folder / v["text"]).exists():
            body = (folder / v["text"]).read_text().split("ATTACHMENT")[0]
            return set(re.findall(r"^\s*ART\s+(\S+)\s+-", body, re.MULTILINE))
    return set()


# OCR misreads of a pasal number's last character: 43I -> 431, 16B -> 168, 62D -> 620.
_LAST = {"1": "I", "8": "B", "0": "D", "6": "G", "5": "S"}


def _checked(changes: dict, known: set[str]) -> dict:
    """Changed / deleted pasal must exist in the base law (or have been inserted by then).
    A number that does not is read again with the usual OCR misreads; if it still does not
    exist it is left out rather than shown wrongly."""
    out = dict(changes)
    for kind in ("diubah", "dihapus"):
        fixed = []
        for n in changes.get(kind, []):
            if n not in known and n[-1:] in _LAST and n[:-1] + _LAST[n[-1]] in known:
                n = n[:-1] + _LAST[n[-1]]
            if n in known:
                fixed.append(n)
        if fixed:
            out[kind] = sorted(set(fixed), key=_natural)
        else:
            out.pop(kind, None)
    return out


def build(data_dir: Path) -> dict[str, int]:
    """Recompute relationships for every regulation record under data/peraturan/."""
    paths = {p.stem: p for p in (data_dir / "peraturan").glob("*/*/*/*.yaml")}
    recs = {k: load_record(p) for k, p in paths.items()}
    rel = {k: {"amends": [], "amended_by": [], "revokes": [], "revoked_by": [],
               "enacts": [], "enacted_by": []} for k in recs}
    for k, rec in recs.items():
        found = from_title(rec.get("tentang") or "")
        if found["amends"]:
            text = ""
            for v in rec.get("versions") or []:
                if v.get("text") and (paths[k].parent / v["text"]).exists():
                    text = (paths[k].parent / v["text"]).read_text()
            from . import amendments

            changes = (amendments.changes(amendments.flatten(text))
                       or changes_in_text(text)) if text else {}
            for entry in found["amends"]:
                # with one target, all instructions belong to it; with several we cannot tell
                if changes and len(found["amends"]) == 1:
                    entry["changes"] = changes
                rel[k]["amends"].append(entry)
                if entry["id"] in rel:
                    rel[entry["id"]]["amended_by"].append(k)
        for target in found["revokes"]:
            rel[k]["revokes"].append(target)
            if target in rel:
                rel[target]["revoked_by"].append(k)
        # peraturan.go.id's status: "Tidak Berlaku Dicabut Oleh : Undang-Undang Nomor 40 Tahun 2007"
        for m in re.finditer(r"Dicabut\s+Oleh\s*:?\s*" + CITE, (rec.get("status") or "").upper()
                             .replace("DICABUT OLEH", "Dicabut Oleh")):
            by = cite_id(m)
            if by != k and by in rel and k not in rel[by]["revokes"]:
                rel[by]["revokes"].append(k)
                rel[k]["revoked_by"].append(by)
        for target in found["enacts"]:
            rel[k]["enacts"].append(target)
            if target in rel:
                rel[target]["enacted_by"].append(k)

    def date_key(i: str) -> tuple[str, str]:      # id breaks ties: same output every run
        r = recs.get(i, {})
        return str(r.get("tanggal_penetapan") or r.get("year") or ""), i

    for k, rec in recs.items():
        for key in ("amended_by", "revoked_by", "enacted_by", "revokes", "enacts"):
            rel[k][key] = sorted(set(rel[k][key]), key=date_key)   # same order on every machine
    for k in rel:                               # inserted pasal always carry a letter (27A):
        for entry in rel[k]["amends"]:          # a trailing digit is an OCR misread (16B->168)
            ins = (entry.get("changes") or {}).get("disisipkan")
            if ins:
                fixed = [n if not n[-1].isdigit() else n[:-1] + "B" if n[-1] == "8" else ""
                         for n in ins]
                entry["changes"]["disisipkan"] = sorted({n for n in fixed if n}, key=_natural)
    for k, rec in recs.items():                 # check numbers against the base law's pasal
        known = _pasal_numbers(rec, paths[k].parent)
        if not known:
            continue
        for by in rel[k]["amended_by"]:
            for entry in rel[by]["amends"]:
                if entry["id"] == k and entry.get("changes"):
                    known |= set(entry["changes"].get("disisipkan", []))
                    entry["changes"] = _checked(entry["changes"], known)

    stats = {"amends": 0, "revokes": 0, "enacts": 0, "with_changes": 0, "updated": 0}
    for k, rec in recs.items():
        r = rel[k]
        stats["amends"] += len(r["amends"])
        stats["revokes"] += len(r["revokes"])
        stats["enacts"] += len(r["enacts"])
        stats["with_changes"] += sum(1 for a in r["amends"] if a.get("changes"))
        if rec.get("relationships") != r:
            rec["relationships"] = r
            save_record(paths[k], rec)
            stats["updated"] += 1
    return stats
