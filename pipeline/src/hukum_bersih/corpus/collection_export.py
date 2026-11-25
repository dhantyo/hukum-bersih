"""``collections/<slug>/*.json``: the records of the collection pages
(``web-solid/scripts/export-collections.ts``). A collection whose base law has a text gets one
merged record per version (``latest.json`` and ``<date>.json``) and, when its amendments can
be read pasal by pasal, ``perubahan.json``. Any other collection gets ``timeline.json``.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from ..akn.build import to_akn_tree
from .koleksi import Koleksi
from .laws import Laws
from .merge import Merged, merged_doc
from .reader_text import Document, read_document, reader_text_of
from .regulations import cite_id
from .timeline import status_of, timeline_record
from .version_history import compare_data
from .versions import VersionRow
from .write import UNDEFINED, js_object, write_json

_SLUG = re.compile(r"[a-z0-9-]+")
_VERSION_NAME = re.compile(r"latest|[0-9]{4}-[0-9]{2}-[0-9]{2}")
_FACT_ROLES = ("pokok", "perubahan", "pendahulu", "lain")


def _fact_label(role: str, order: int | None) -> str:
    if role == "pokok":
        return "Undang-undang pokok"
    if role == "perubahan":
        return "Perubahan" if not order else f"Perubahan ke-{order}"
    return "Menggantikan" if role == "pendahulu" else "Terkait"


def _citation(laws: Laws, law_id: str) -> dict[str, Any]:
    href = laws.href(law_id)
    return {"label": cite_id(law_id), "href": UNDEFINED if href is None else href}


def _facts(laws: Laws, koleksi: Koleksi) -> list[dict[str, Any]]:
    members = laws.collections.members(koleksi)
    cited = {member.id: _citation(laws, member.id) for member in members}
    return [{"label": _fact_label(role, member.order), "value": cited[member.id]["label"],
             "href": cited[member.id]["href"]}
            for role in _FACT_ROLES for member in members if member.role == role]


def _version_row(row: VersionRow) -> dict[str, Any]:
    return {"label": row.label, "date": row.date,
            "href": UNDEFINED if row.href is None else row.href, "sub": row.sub,
            "missing": row.kind == "missing", "inForce": row.in_force}


def _merged_record(laws: Laws, koleksi: Koleksi, merged: Merged,
                   rows: list[VersionRow]) -> dict[str, Any]:
    base, point = koleksi.base, merged.point
    return {
        "date": point.get("date", UNDEFINED),
        "title": koleksi.name if koleksi.named else base.subject or base.title,
        "baseTitle": base.title,
        "status": status_of(base.status),
        "amended": laws.regulations.amendment_count(base),
        "base": {"label": cite_id(base.id), "href": f"/{base.path}"},
        "amendments": [_citation(laws, i) for i in point.get("after") or []],
        "facts": _facts(laws, koleksi),
        "versions": [_version_row(row) for row in rows],
        "incomplete": point.get("complete") is False or bool(merged.unreadable),
        "missing": point.get("missing_before") or 0,
        "unreadable": list(merged.unreadable),
        "unapplied": [
            {"header": entry.get("header", UNDEFINED),
             "instruction": entry.get("instruction", UNDEFINED),
             "by": _citation(laws, entry["by"])}
            for entry in point.get("not_applied") or [] if entry.get("affects_wording")],
        "notes": js_object(merged.notes.items()),
        "text": reader_text_of(merged.document),
    }


def _version_records(laws: Laws, koleksi: Koleksi, original: Document) -> dict[str, dict]:
    """The merged record of every version we can write, by file name; a later point with the
    same date replaces an earlier one."""
    points = koleksi.base.history["points"] if koleksi.base.history else []
    rows = laws.rows_of(koleksi)
    records: dict[str, dict] = {}
    for point in points:
        is_latest = point is points[-1]
        if point["kind"] != "gabungan" or (not is_latest and not point.get("date")):
            continue
        merged = merged_doc(laws, koleksi, point["id"], original)
        if merged is None:
            continue
        name = "latest" if is_latest else point["date"]
        if not _VERSION_NAME.fullmatch(name):
            raise ValueError(f"Invalid collection version: {name}")
        records[name] = _merged_record(laws, koleksi, merged, rows)
    return records


def _original(koleksi: Koleksi) -> Document | None:
    base = koleksi.base
    if not base.has_text:
        return None
    return read_document(to_akn_tree(
        (base.folder / base.text_version["text"]).read_text(encoding="utf-8"), base.akn))


def export_collection(laws: Laws, koleksi: Koleksi, directory: Path) -> None:
    """Write the records of one collection into ``directory``."""
    original = _original(koleksi)
    records: dict[str, Any] = {}
    if original is not None:
        if laws.has_amendment_steps(koleksi.base):
            records["perubahan"] = compare_data(laws, koleksi.base, original)
        records.update(_version_records(laws, koleksi, original))
    if "latest" not in records:
        records["timeline"] = timeline_record(laws, koleksi, original)
    for name, record in records.items():
        write_json(directory / f"{name}.json", record, newline=False)


def export_collections(laws: Laws, stage: Path) -> str:
    """Write ``collections/<slug>/*.json`` for every collection into ``stage``."""
    for koleksi in laws.collections.all:
        if not _SLUG.fullmatch(koleksi.slug):
            raise ValueError(f"Invalid collection slug: {koleksi.slug}")
        export_collection(laws, koleksi, stage / "collections" / koleksi.slug)
    return f"Exported {len(laws.collections.all)} collections"
