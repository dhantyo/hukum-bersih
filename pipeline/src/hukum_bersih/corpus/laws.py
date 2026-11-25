"""``laws/<type>/<number>/<year>/index.json``: one record per law for the reader page
(``web-solid/scripts/export-laws.ts``).
"""

from __future__ import annotations

import os
import re
import shutil
import tempfile
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
from typing import Any

from .. import amendments
from ..akn.build import to_akn_tree
from .koleksi import Collections, Koleksi, ordinal
from .reader_text import reader_text
from .regulations import STATUS_LABEL, Regulation, Regulations, cite_id, source_name
from .versions import version_rows
from .write import UNDEFINED, js_object, write_json

LAW_PATH = re.compile(r"/uu/[0-9]+/[0-9]{4}/")
_ORDINALS = ["", "", "Kedua", "Ketiga", "Keempat", "Kelima", "Keenam", "Ketujuh", "Kedelapan",
             "Kesembilan", "Kesepuluh"]


def _undefined_if_none(value: Any) -> Any:
    return UNDEFINED if value is None else value


def _has_text(law: Regulation) -> bool:
    version = law.text_version
    return version is not None and (law.folder / version["text"]).exists()


def _tree_text(job: tuple[Path, str]) -> dict[str, Any]:
    """The reader text of one stored Bluebell text (runs in a worker process)."""
    path, akn = job
    return reader_text(to_akn_tree(path.read_text(encoding="utf-8"), akn))


class Laws:
    """What the reader record of a law needs to know about the other laws."""

    def __init__(self, data_dir: Path) -> None:
        self.regulations = Regulations(data_dir)
        self.collections = Collections(data_dir, self.regulations)
        self._amending: dict[str, dict | None] = {}
        self._rows: dict[str, list] = {}

    # -- links and names -------------------------------------------------------------------

    def href(self, law_id: str) -> str | None:
        path = self.regulations.path_of(law_id)
        return None if path is None else f"/{path}"

    def _linked(self, law_id: str) -> dict[str, Any]:
        return {"label": self.regulations.name_of(law_id), "href": _undefined_if_none(self.href(law_id))}

    # -- amendments ------------------------------------------------------------------------

    def _amending_law(self, law_id: str) -> dict | None:
        """The instructions of an amending law, split by ``amendments.split``."""
        if law_id not in self._amending:
            law = self.regulations.get(law_id)
            self._amending[law_id] = law and amendments.split(
                {"id": law.id, "relationships": law.relationships, "versions": law.versions},
                law.folder)
        return self._amending[law_id]

    def has_amendment_steps(self, law: Regulation) -> bool:
        """Whether a law has amendments we can show pasal by pasal."""
        return any((self._amending_law(i) or {}).get("amends") == law.id
                   for i in law.relationships["amended_by"])

    def compared_anchors(self, law: Regulation) -> set[str]:
        """The anchors ("uu_3_2020-pasal-4") of every pasal an amendment of ``law`` changes."""
        anchors = set()
        for event in self.regulations.history(law):
            data = self._amending_law(event.by) if event.kind == "diubah" else None
            if data and data["amends"] == law.id:
                anchors.update(f"{event.by}-pasal-{p['num']}"
                               for instruction in data["instructions"] for p in instruction["pasal"])
        return anchors

    def short_name(self, law: Regulation) -> str | None:
        """"UU ITE" for the base law of a named collection, "Perubahan Kedua UU ITE" for an
        amending law."""
        koleksi = self.collections.of(law.id)
        if koleksi is None or not koleksi.named:
            return None
        if koleksi.base.id == law.id:
            return koleksi.name
        entry = next((a for a in law.relationships["amends"] if a["id"] == koleksi.base.id), None)
        if entry is None:
            return None
        order = entry.get("order")
        if order and order > 1:
            word = _ORDINALS[order] if order < len(_ORDINALS) else order
            return f"Perubahan {word} {koleksi.name}"
        return f"Perubahan {koleksi.name}"

    # -- the pieces of a record --------------------------------------------------------------

    def _rows_of(self, koleksi: Koleksi) -> list:
        if koleksi.slug not in self._rows:
            self._rows[koleksi.slug] = version_rows(koleksi, _has_text(koleksi.base))
        return self._rows[koleksi.slug]

    def _revokers(self, law: Regulation) -> list[dict]:
        regs = self.regulations
        return [{**self._linked(i), "date": (regs.get(i).tanggal_penetapan if regs.get(i) else None)}
                for i in law.relationships["revoked_by"]]

    def _relations(self, law: Regulation) -> list[dict]:
        related = law.relationships
        rows = [("mengubah", a["id"], _change_count(a.get("changes")), True) for a in related["amends"]]
        rows += [("mencabut", i, 0, False) for i in related["revokes"]]
        rows += [("menetapkan menjadi undang-undang", i, 0, False) for i in related["enacts"]]
        return [{"verb": verb, "count": count, "history": history, **self._linked(i)}
                for verb, i, count, history in rows]

    def _notes(self, law: Regulation, comparable: bool, anchors: set[str]) -> dict[str, list]:
        return js_object(
            (number, [{"label": cite_id(i), "href": _undefined_if_none(self.href(i)),
                       "by": i if comparable and f"{i}-pasal-{number}" in anchors else UNDEFINED}
                      for i in ids])
            for number, ids in self.regulations.pasal_notes(law).items())

    def _steps(self, law: Regulation, koleksi: Koleksi) -> list[dict]:
        steps = []
        for event in self.collections.timeline(koleksi):
            if event.kind == "dicabut":
                continue
            if event.kind == "tidak-tersedia":
                label = cite_id(event.id) if event.id else re.sub(r"^Perubahan ", "perubahan ", event.what)
                steps.append({"kind": "missing", "label": label,
                              "title": f"{event.what}: belum tersedia"})
            else:
                steps.append({"kind": event.kind, "label": cite_id(event.law.id),
                              "here": event.law.id == law.id,
                              "href": _undefined_if_none(self.href(event.law.id)),
                              "order": ordinal(event.order) if event.kind == "perubahan" else UNDEFINED})
        return steps

    def _family(self, law: Regulation, koleksi: Koleksi, has_text: bool) -> dict:
        is_base = koleksi.base.id == law.id
        rows = self._rows_of(koleksi)
        current = law.history["points"][0]["id"] if is_base and law.history else None
        latest = rows[-1] if rows else None
        return {
            "slug": koleksi.slug, "name": koleksi.name, "named": koleksi.named, "isBase": is_base,
            "role": self.collections.role_label(koleksi, law.id),
            "versions": [{
                "kind": row.kind, "label": row.label, "sub": row.sub, "date": row.date,
                "href": _undefined_if_none(row.href), "inForce": row.in_force,
                "here": row.point is not None and row.point["id"] == current,
                "made": row.point is not None and not is_base
                and law.id in (row.point.get("after") or []),
            } for row in rows],
            "latestHref": latest.href if is_base and latest and latest.href else UNDEFINED,
            "comparable": has_text and is_base and self.has_amendment_steps(law),
            "steps": self._steps(law, koleksi),
        }

    def _perubahan_target(self, law: Regulation, has_text: bool) -> str:
        koleksi = self.collections.of(law.id)
        rows = self._rows_of(koleksi) if koleksi else []
        last = rows[-1] if rows else None
        own = f"/{law.path}"
        if last and last.href and last.point and last.point["kind"] == "gabungan":
            return last.href
        if koleksi and koleksi.base.id == law.id and has_text:
            return own
        return f"/{koleksi.path}" if koleksi else own

    def reader_law(self, law: Regulation, text: dict[str, Any] | None) -> dict[str, Any]:
        """The record of one law; ``text`` is its reader text, None when it has none."""
        regs = self.regulations
        has_text = text is not None
        koleksi = self.collections.of(law.id)
        family = self._family(law, koleksi, has_text) if koleksi else None
        compared = self.compared_anchors(law)
        return {
            "path": f"/{law.path}", "title": law.title, "subject": law.subject,
            "shortName": _undefined_if_none(self.short_name(law)), "cite": law.short_cite,
            "year": law.year, "status": law.status,
            "statusLabel": STATUS_LABEL.get(law.status or "", law.status),
            "date": law.tanggal_penetapan, "place": law.tempat_penetapan,
            "official": law.pejabat_penetapan, "initiator": law.pemrakarsa,
            "pasalCount": next((v["pasal_count"] for v in law.versions
                                if (v.get("pasal_count") or 0) > 0), UNDEFINED),
            "amendmentCount": regs.amendment_count(law),
            "source": law.source_url, "sourceName": source_name(law.source_url),
            "pdf": law.source_pdf_url, "archive": _undefined_if_none(law.archive_url),
            "text": text, "missingText": UNDEFINED if has_text else _missing_text(law),
            "revokedBy": self._revokers(law), "relations": self._relations(law),
            "notes": self._notes(law, bool(family and family["comparable"]), compared),
            "family": _undefined_if_none(family),
            "perubahanTarget": self._perubahan_target(law, has_text),
        }


def _change_count(changes: dict | None) -> int:
    return sum(len((changes or {}).get(kind) or []) for kind in ("diubah", "disisipkan", "dihapus"))


def _missing_text(law: Regulation) -> str:
    if law.pdf_quality:
        return "ocr"
    return "unparsed" if law.parse_error else "pending"


def export_laws(data_dir: Path, stage: Path) -> str:
    """Write ``laws/**/index.json`` for every UU into ``stage``; one law's reader text is
    built from its Bluebell text in a worker process."""
    laws_data = Laws(data_dir)
    laws = [law for law in laws_data.regulations.all if law.type == "uu"]
    if not laws:
        raise ValueError("The corpus contains no laws")
    for law in laws:
        if law.text_version and not _has_text(law):
            raise ValueError(f"The text file is missing for {law.id}")
    jobs = [(law.folder / law.text_version["text"], law.akn) for law in laws if law.text_version]

    stage.mkdir(parents=True, exist_ok=True)
    scratch = Path(tempfile.mkdtemp(prefix=".laws-", dir=stage))
    try:
        with ProcessPoolExecutor() as pool:
            texts = pool.map(_tree_text, jobs, chunksize=4)          # in the order of ``laws``
            for law in laws:
                if not LAW_PATH.fullmatch(f"/{law.path}"):
                    raise ValueError(f"Invalid law path: {law.path}")
                text = next(texts) if law.text_version else None
                write_json(scratch / law.path / "index.json", laws_data.reader_law(law, text))
        os.rename(scratch, stage / "laws")
    finally:
        shutil.rmtree(scratch, ignore_errors=True)
    return f"Exported {len(laws)} laws"
