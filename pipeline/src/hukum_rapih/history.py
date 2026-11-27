"""The versions of an amended law and every change made to it (decision 0010).

Written into the amended law's record as ``history`` (the law is the "work"; each version of
its text is a "point in time"), the same model as Fedlex's JOLux (Work / Consolidation /
LegalResourceImpact) and Laws.Africa's points in time:

    history:
      points:                         # every version of the text, oldest first
      - id: uu_4_2009_2009-01-12      # docs/NAMING.md: <work>_<date it took effect>
        kind: asli                    # the law as enacted: a stored text version
        date: '2009-01-12'
        date_basis: tanggal_penetapan
        text: uu_4_2009_2009-01-12.txt
      - id: uu_4_2009_2020-06-10
        kind: gabungan                # merged by us: the text before + this amendment
        date: '2020-06-10'
        date_basis: tanggal_penetapan
        after: [uu_3_2020]            # the amending law(s) this point adds
        order: 1                      # "perubahan pertama" (from the amending law's title)
        counts: {diubah: 76, disisipkan: 52, dihapus: 20}
        missing_before: 0             # amendments before this point that we do not have
        unreadable: []                # pasal whose new wording could not be read, so far
        not_applied: [...]            # instructions not split into pasal changes (headings,
                                      # Penjelasan, or not readable: those make it incomplete)
        complete: true                # every pasal's wording is known at this point
      changes:                        # every change to a pasal, oldest first
      - pasal: '4'
        type: diubah                  # diubah | disisipkan | dihapus
        by: uu_3_2020
        instruction: 2                # its number in Pasal I of the amending law
        point: uu_4_2009_2020-06-10
        wording: read                 # read | unreadable | none (deleted)

Only regulations that have been amended get a ``history``. Recomputed from the stored texts on
every run (idempotent). The merged texts themselves are not stored: the website builds them from
the original text and the amending laws' instructions (pipeline/src/hukum_rapih/amendments.py).
"""

from __future__ import annotations

import re
from pathlib import Path

from . import amendments
from .records import load_record, save_record

# An instruction we could not split into pasal changes is taken to change pasal wording (so the
# merged text at that point is not complete) unless it is clearly about the Penjelasan or a
# heading: "Penjelasan Pasal 38 diubah", "Ketentuan Pasal 5 tetap dengan perubahan penjelasan",
# "Judul BAB III diubah", "Di antara BAB IV dan BAB V disisipkan 1 (satu) bab".
NOT_WORDING = re.compile(r"^\s*(?:Penjelasan|Judul|Di\s*antara\s+(?:BAB|Bab|Bagian|Paragraf)\b"
                         r"|(?:Bagian\s+\S+\s+)?(?:BAB|Bab)\s+\S+\s+diubah)"
                         r"|tetap\s+dengan\s+perubahan\s+penjelasan")

DATE_FIELDS = ("tanggal_berlaku", "tanggal_pengundangan", "tanggal_penetapan")


def _date(rec: dict) -> tuple[str | None, str | None]:
    """When a regulation took effect, as precisely as the record knows, and which field said so."""
    for f in DATE_FIELDS:
        if rec.get(f):
            return str(rec[f]), f
    return (str(rec["year"]), "year") if rec.get("year") else (None, None)


def _text(rec: dict, folder: Path) -> str:
    for v in reversed(rec.get("versions") or []):
        if v.get("text") and (folder / v["text"]).exists():
            return (folder / v["text"]).read_text()
    return ""


def history_of(rec: dict, recs: dict[str, dict], folders: dict[str, Path]) -> dict | None:
    """The ``history`` block for one regulation, or None when it has not been amended."""
    by_ids = (rec.get("relationships") or {}).get("amended_by") or []
    if not by_ids:
        return None
    original = next((v for v in rec.get("versions") or [] if v.get("text")), None)
    date, basis = _date(rec)
    first = {"id": original["id"] if original else f"{rec['id']}_{date}", "kind": "asli",
             "date": date, "date_basis": basis}
    if original:
        first["text"] = original["text"]
    points: list[dict] = [first]
    changes: list[dict] = []
    seen = missing = 0
    unreadable: list[str] = []
    blind = False                                # an amending law whose changes we cannot read
    for by in by_ids:
        amending = recs.get(by)
        entry = next((a for a in ((amending or {}).get("relationships") or {}).get("amends") or []
                      if a.get("id") == rec["id"]), None)
        order = (entry or {}).get("order") or seen + 1
        missing += max(0, order - seen - 1)
        seen = max(seen + 1, order)
        found = amendments.instructions(amendments.flatten(_text(amending, folders[by]))) \
            if amending else []
        when, when_basis = _date(amending) if amending else (None, None)
        point_id = f"{rec['id']}_{when}"
        if points[-1]["id"] == point_id and points[-1]["kind"] == "gabungan":
            point = points[-1]                       # same day: one point (Laws.Africa does too)
            point["after"].append(by)
        else:
            point = {"id": point_id, "kind": "gabungan", "date": when, "date_basis": when_basis,
                     "after": [by], "order": order,
                     "counts": {"diubah": 0, "disisipkan": 0, "dihapus": 0},
                     "missing_before": missing, "unreadable": [], "not_applied": [], "complete": True}
            points.append(point)
        blind_here = False                       # this amendment changes pasal we could not apply
        if found:
            for ins in found:
                if not ins.pasal:
                    wording = not NOT_WORDING.search(ins.header)
                    point["not_applied"].append({"by": by, "instruction": ins.n,
                                                 "header": ins.header[:160],
                                                 "affects_wording": wording})
                    blind_here = blind_here or wording
                for p in ins.pasal:
                    wording = "none" if p.kind == "dihapus" else "read" if p.text else "unreadable"
                    changes.append({"pasal": p.num, "type": p.kind, "by": by,
                                    "instruction": ins.n, "point": point["id"], "wording": wording})
                    point["counts"][p.kind] += 1
                    if wording == "unreadable" and p.num not in unreadable:
                        unreadable.append(p.num)
                    elif wording != "unreadable" and p.num in unreadable:
                        unreadable.remove(p.num)       # a later amendment replaced it
        else:
            # no readable instructions: what the title / relations know, without wording
            for kind, nums in ((entry or {}).get("changes") or {}).items():
                for num in nums:
                    changes.append({"pasal": num, "type": kind, "by": by, "instruction": None,
                                    "point": point["id"],
                                    "wording": "none" if kind == "dihapus" else "unreadable"})
                    point["counts"][kind] += 1
                    if kind != "dihapus" and num not in unreadable:
                        unreadable.append(num)
            if not (entry or {}).get("changes"):
                blind = True
                point["not_applied"].append({"by": by, "instruction": None,
                                             "header": "teks perubahan belum dapat dibaca",
                                             "affects_wording": True})
        point["missing_before"] = missing
        point["unreadable"] = sorted(unreadable, key=amendments._key)
        blind = blind or blind_here or not found
        point["complete"] = (missing == 0 and not unreadable and original is not None
                             and not blind)
    return {"points": points, "changes": changes}


def build(data_dir: Path) -> dict[str, int]:
    """Recompute ``history`` for every regulation record; returns counts."""
    paths = {p.stem: p for p in (data_dir / "peraturan").glob("*/*/*/*.yaml")}
    recs = {k: load_record(p) for k, p in paths.items()}
    folders = {k: p.parent for k, p in paths.items()}
    stats = {"with_history": 0, "points": 0, "changes": 0, "complete_latest": 0, "updated": 0}
    for k, rec in recs.items():
        h = history_of(rec, recs, folders)
        if h:
            stats["with_history"] += 1
            stats["points"] += len(h["points"])
            stats["changes"] += len(h["changes"])
            stats["complete_latest"] += int(h["points"][-1].get("complete", False))
        if rec.get("history") != h:
            if h is None:
                rec.pop("history", None)
            else:
                rec["history"] = h
            save_record(paths[k], rec)
            stats["updated"] += 1
    return stats
