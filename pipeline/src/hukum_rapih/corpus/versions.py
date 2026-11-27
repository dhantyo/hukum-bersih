"""The versions of a law family, from the base law's ``history`` (``history.py``, decision
0010): the text as enacted, then one merged version per amending law
(``web/src/lib/versions.ts``)."""

from __future__ import annotations

from dataclasses import dataclass

from .koleksi import Koleksi, ordinal
from .regulations import cite_id


@dataclass(frozen=True)
class VersionRow:
    kind: str                       # point | missing
    label: str                      # "Teks asli", "Setelah UU 3/2020", "Perubahan kedua"
    sub: str                        # "perubahan pertama · 76 diubah, 52 baru, 20 dihapus"
    date: str | None
    in_force: bool                  # the latest point of a law in force
    point: dict | None = None       # the history point of a ``point`` row
    href: str | None = None


def point_href(koleksi: Koleksi, point: dict, latest: dict) -> str:
    """URL of one point: the original text is the law page; the latest merged version is the
    Koleksi page; older merged versions have a dated page under it."""
    if point["kind"] == "asli":
        return f"/{koleksi.base.path}"
    if point["id"] == latest["id"]:
        return f"/{koleksi.path}"
    date = "null" if point["date"] is None else point["date"]        # as JavaScript prints null
    return f"/{koleksi.path}{date}/"


def _counts(counts: dict | None) -> str:
    if not counts:
        return ""
    parts = [(counts["diubah"], "diubah"), (counts["disisipkan"], "baru"),
             (counts["dihapus"], "dihapus")]
    return ", ".join(f"{n} {word}" for n, word in parts if n)


def version_rows(koleksi: Koleksi, base_has_text: bool) -> list[VersionRow]:
    """The rows of the "Versi" list, oldest first, with known but missing amendments as rows.
    ``base_has_text``: merged versions can only be built from the base law's text."""
    history = koleksi.base.history
    if not history or len(history["points"]) < 2:
        return []
    latest = history["points"][-1]
    in_force = (koleksi.base.status or "") not in ("dicabut", "tidak_berlaku")
    rows: list[VersionRow] = []
    missing_so_far = seen = 0
    for point in history["points"]:
        if point["kind"] == "gabungan":
            missing = point.get("missing_before") or 0
            for n in range(missing - missing_so_far):
                rows.append(VersionRow("missing", f"Perubahan {ordinal(seen + n + 1)}",
                                       "belum tersedia di sini", None, False))
            seen = max(seen + 1 + (missing - missing_so_far), point.get("order") or 0)
            missing_so_far = missing
        is_latest = point["id"] == latest["id"]
        asli = point["kind"] == "asli"
        if asli:
            label, sub = "Teks asli", cite_id(koleksi.base.id)
        else:
            label = f"Setelah {' dan '.join(cite_id(i) for i in point.get('after') or [])}"
            sub = " · ".join(filter(None, [
                f"perubahan {ordinal(point['order'])}" if point.get("order") else "",
                _counts(point.get("counts")),
                "belum lengkap" if point.get("complete") is False else ""]))
        rows.append(VersionRow(
            "point", label, sub, point["date"], is_latest and in_force, point,
            point_href(koleksi, point, latest) if asli or base_has_text else None))
    return rows
