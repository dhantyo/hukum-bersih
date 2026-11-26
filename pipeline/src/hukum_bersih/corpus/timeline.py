"""The record of a collection that has no merged text: what happened to it, oldest first, and
what we lack (``web-solid/scripts/collection-timeline.ts``).
"""

from __future__ import annotations

from typing import Any

from .koleksi import Koleksi, TimelineEvent, ordinal
from .laws import Laws
from .pasal import collect_pasal
from .reader_text import Document, pasal_key
from .regulations import STATUS_LABEL, amends_entry, cite_id
from .write import UNDEFINED

_GROUPS = (("diubah", "Diubah"), ("disisipkan", "Pasal baru"), ("dihapus", "Dihapus"))
_KIND_ROLES = {
    "pendahulu": "Digantikan",
    "pokok": "Undang-undang pokok",
    "dicabut": "Dicabut",
    "ditetapkan-dari": "Ditetapkan menjadi undang-undang",
}


def status_of(status: str | None) -> dict[str, str] | None:
    """The status a law shows next to its name; None when it has none."""
    if not status:
        return None
    return {"key": status, "label": STATUS_LABEL.get(status, status)}


def timeline_record(laws: Laws, koleksi: Koleksi, document: Document | None) -> dict[str, Any]:
    """``document``: the text of the base law, None when we have none."""
    base = koleksi.base
    base_href = f"/{base.path}"
    compared = {amendment.by for amendment in laws.readable_amendments(base)}
    anchors = {p.num: p.eId for p in collect_pasal(document.body)} if document else {}

    def change_href(by: str, kind: str, num: str) -> str | None:
        if by in compared:
            return f"{base_href}?v={by}#cmp-pasal-{pasal_key(num)}"
        anchor = anchors.get(num)
        return f"{base_href}#{anchor}" if kind != "disisipkan" and anchor is not None else None

    def law_event(event: TimelineEvent, dotted: bool) -> dict[str, Any]:
        law = event.law
        changes = (amends_entry(law, base.id) or {}).get("changes") \
            if event.kind == "perubahan" else None
        href = laws.href(law.id)
        return {
            "kind": event.kind,
            "dotted": dotted,
            "date": law.tanggal_penetapan,
            "role": f"Perubahan {ordinal(event.order)}" if event.kind == "perubahan"
                    else _KIND_ROLES[event.kind],
            "law": {"label": cite_id(law.id), "href": UNDEFINED if href is None else href},
            "subject": law.subject or UNDEFINED,
            "noText": not any(version.get("text") for version in law.versions),
            "status": (status_of(law.status) or UNDEFINED) if event.kind == "pokok" else UNDEFINED,
            "changes": [
                {"key": key, "label": label, "items": [
                    {"num": num, "href": change_href(law.id, key, num) or UNDEFINED}
                    for num in nums]}
                for key, label in _GROUPS if (nums := (changes or {}).get(key) or [])],
            "compareHref": f"{base_href}?v={law.id}"
                           if event.kind == "perubahan" and law.id in compared else UNDEFINED,
        }

    events = laws.collections.timeline(koleksi)
    records = []
    for index, event in enumerate(events):
        following = events[index + 1] if index + 1 < len(events) else None
        dotted = event.kind == "tidak-tersedia" or (following is not None
                                                    and following.kind == "tidak-tersedia")
        if event.kind == "tidak-tersedia":
            records.append({"kind": event.kind, "dotted": dotted, "what": event.what,
                            "id": cite_id(event.id) if event.id is not None else UNDEFINED,
                            "why": event.why})
        else:
            records.append(law_event(event, dotted))
    return {
        "count": sum(1 for m in laws.collections.members(koleksi) if m.role != "pendahulu"),
        "amended": laws.regulations.amendment_count(base),
        "status": status_of(base.status),
        "base": {"label": cite_id(base.id), "href": base_href},
        "detailed": laws.has_amendment_steps(base),
        "events": records,
    }
