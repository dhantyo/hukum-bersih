"""``law-catalog.json`` and ``listings/``: what the search box and the listing pages read
(``web-solid/scripts/export-catalog.ts`` and ``law-listings.ts``, with ``search-catalog.ts`` and
``labels.ts`` of ``web/src/lib``).

Only what the release holds is listed: the catalog and the listings read the stage's ``laws/``
and ``drafts/`` folders, so they never point at a page that was not written.
"""

from __future__ import annotations

import re
from collections import defaultdict
from pathlib import Path
from typing import Any

from .drafts import load_ruus, versions
from .koleksi import ORDINALS, Koleksi
from .laws import Laws
from .regulations import SOURCE_NAMES, STATUS_LABEL, Regulation, cite_id, source_host
from .write import write_json

RECENT_LAWS = 20
_MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus",
           "September", "Oktober", "November", "Desember"]
_NUMBER = re.compile(r"[0-9]+")


def tanggal(date: str) -> str:
    """"2026-11-19" -> "19 November 2026", "2023-05" -> "Mei 2023", "2008" -> "2008"
    (``tanggal`` in ``labels.ts``, which prints "undefined" and "NaN" for a malformed date)."""
    year, month, day = [*date.split("-"), None, None][:3]
    if not month:
        return year
    index = int(month) - 1 if _NUMBER.fullmatch(month) else -1
    name = _MONTHS[index] if 0 <= index < len(_MONTHS) else "undefined"
    if not day:
        return f"{name} {year}"
    return f"{int(day) if _NUMBER.fullmatch(day) else 'NaN'} {name} {year}"


# --- the catalog -------------------------------------------------------------------------

def _law_entry(laws: Laws, law: Regulation) -> dict[str, Any]:
    return {
        "id": law.id, "s": laws.short_name(law), "c": law.short_cite, "t": law.subject,
        "n": law.number, "y": law.year, "st": law.status,
        "m": [a["id"] for a in law.relationships["amends"]],
        "k": laws.regulations.amendment_count(law), "u": f"/{law.path}",
    }


def _draft_entry(bill: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": f"ruu_{bill['slug']}", "s": bill.get("short_name"), "c": "RUU", "t": bill["title"],
        "n": "", "y": 0, "st": "ruu", "m": [], "k": 0, "u": f"/ruu/{bill['slug']}/",
    }


def _member_role(role: str, order: int | None) -> str:
    if role == "perubahan":
        number = order or 0
        word = ORDINALS[number] if 0 <= number < len(ORDINALS) else number
        return f"perubahan {word}"
    return "pokok" if role == "pokok" else "digantikan"


def _koleksi_entry(laws: Laws, koleksi: Koleksi) -> dict[str, Any]:
    return {
        "slug": koleksi.slug, "name": koleksi.name, "named": koleksi.named, "t": koleksi.title,
        "a": list(koleksi.aliases), "k": laws.regulations.amendment_count(koleksi.base),
        "u": f"/{koleksi.path}",
        "mem": [[m.id, _member_role(m.role, m.order)] for m in laws.collections.members(koleksi)],
    }


# --- the listings ------------------------------------------------------------------------

def _has_text(law: Regulation) -> bool:
    return any(v.get("text") for v in law.versions)


def _law_row(laws: Laws, law: Regulation) -> dict[str, Any]:
    relations = law.relationships
    return {
        "u": f"/{law.path}", "title": law.subject or law.title, "short": laws.short_name(law),
        "cite": law.short_cite,
        "status": None if law.status is None else {
            "key": law.status, "label": STATUS_LABEL.get(law.status, law.status)},
        "date": None if law.tanggal_penetapan is None else tanggal(law.tanggal_penetapan),
        "changed": laws.regulations.amendment_count(law) if relations["amended_by"] else 0,
        "amends": [cite_id(a["id"]) for a in relations["amends"]],
        "hasText": _has_text(law),
    }


def _sources(listed: list[Regulation]) -> list[dict[str, Any]]:
    """The hosts the laws come from, the one with most laws first."""
    counts: dict[str, int] = {}
    for law in listed:
        host = source_host(law.source_url)
        if host is not None:
            counts[host] = counts.get(host, 0) + 1
    return [{"host": host, "name": SOURCE_NAMES.get(host, host)}
            for host in sorted(counts, key=lambda h: -counts[h])]


def _decades(listed: list[Regulation]) -> list[dict[str, Any]]:
    per_year: dict[int, int] = defaultdict(int)
    for law in listed:
        per_year[law.year] += 1
    decades: dict[int, list[dict[str, int]]] = {}
    for year in sorted(per_year, reverse=True):
        decades.setdefault(year // 10 * 10, []).append({"year": year, "count": per_year[year]})
    return [{"decade": decade, "years": years} for decade, years in decades.items()]


def _overview(laws: Laws, listed: list[Regulation]) -> dict[str, Any]:
    return {
        "total": len(listed), "withText": sum(_has_text(law) for law in listed),
        "sources": _sources(listed), "decades": _decades(listed),
        "recent": [_law_row(laws, law) for law in listed[:RECENT_LAWS]],
    }


def _year_pages(laws: Laws, listed: list[Regulation]) -> dict[int, dict[str, Any]]:
    rows: dict[int, list[dict[str, Any]]] = {}
    for law in listed:
        rows.setdefault(law.year, []).append(_law_row(laws, law))
    return {year: {"year": year, "rows": year_rows} for year, year_rows in rows.items()}


def _draft_row(bill: dict[str, Any]) -> dict[str, Any]:
    stages = bill["stages"]
    texts = versions(bill)
    short_name = bill.get("short_name")
    last = stages[-1] if stages else None
    return {
        "slug": bill["slug"], "name": bill["title"] if short_name is None else short_name,
        "title": bill["title"], "versions": len(texts),
        "last": None if last is None else {
            "stage": last["stage"], "note": last.get("note"), "date": tanggal(last["date"])},
        "changes": {"from": texts[0]["id"], "to": texts[-1]["id"]} if len(texts) > 1 else None,
    }


# --- the files ---------------------------------------------------------------------------

def _written_paths(stage: Path) -> set[str]:
    """The site paths of the laws and drafts that ``stage`` holds."""
    laws = {f"/uu/{index.parent.parent.name}/{index.parent.name}/"
            for index in (stage / "laws" / "uu").glob("*/*/index.json")}
    if not laws:
        raise ValueError("The release contains no exported law documents")
    return laws | {f"/ruu/{index.parent.name}/" for index in (stage / "drafts").glob("*/index.json")}


def export_catalog(laws: Laws, data_dir: Path, stage: Path) -> str:
    """Write ``law-catalog.json`` and ``listings/`` into ``stage``, after ``laws/`` and
    ``drafts/``. A release that lacks some law lists only the pages it has."""
    regulations = laws.regulations
    paths = _written_paths(stage)
    complete = all(f"/{law.path}" in paths for law in regulations.all if law.type == "uu")
    bills = load_ruus(data_dir)

    catalog = [*(_law_entry(laws, law) for law in regulations.all), *map(_draft_entry, bills)]
    published = {
        "laws": [entry for entry in catalog
                 if entry["u"] in paths or (complete and entry["c"] != "RUU")],
        "koleksi": [_koleksi_entry(laws, k) for k in laws.collections.all] if complete else [],
    }
    write_json(stage / "law-catalog.json", published)

    listed = [law for law in regulations.all
              if law.type == "uu" and (complete or f"/{law.path}" in paths)]
    listings = stage / "listings"
    write_json(listings / "overview.json", _overview(laws, listed))
    for year, page in _year_pages(laws, listed).items():
        write_json(listings / "years" / f"{year}.json", page)
    write_json(listings / "drafts.json",
               [_draft_row(bill) for bill in bills if f"/ruu/{bill['slug']}/" in paths])
    return f"Listed {len(published['laws'])} laws, {len(published['koleksi'])} collections"
