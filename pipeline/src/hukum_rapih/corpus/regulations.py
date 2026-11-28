"""The law records as the website's code sees them (``web/src/lib/peraturan.ts``): display
title and subject, the status the site shows, relations with their defaults, the history of a
law's amendments. Records are read through ``load_record``.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from ..records import load_record
from .jstext import judul

# type -> (name, short name), as ``JENIS`` in peraturan.ts
JENIS = {
    "uu": ("Undang-Undang", "UU"),
    "perppu": ("Peraturan Pemerintah Pengganti Undang-Undang", "Perppu"),
    "pp": ("Peraturan Pemerintah", "PP"),
    "perpres": ("Peraturan Presiden", "Perpres"),
}
# The types the site has pages for; the UUD 1945, its amendments and Keppres 150/1959 are in
# data/ (decision 0027) but not shown yet.
SITE_TYPES = frozenset({"uu", "perppu"})
STATUS_LABEL = {
    "berlaku": "Berlaku",
    "diubah": "Diubah",
    "dicabut": "Dicabut",
    "tidak_berlaku": "Tidak berlaku",
}
SOURCE_NAMES = {"peraturan.bpk.go.id": "JDIH BPK", "peraturan.go.id": "peraturan.go.id"}
_NO_RELATIONS: dict[str, list] = {
    "amends": [], "amended_by": [], "revokes": [], "revoked_by": [], "enacts": [], "enacted_by": [],
}
_CITATION = re.compile(
    r"^\s*(?:UNDANG-UNDANG|PERATURAN\s+\S+)(?:\s+REPUBLIK\s+INDONESIA)?\s+NOMOR\s+\S+\s+TAHUN\s+"
    r"[0-9]{4}\s+TENTANG\s+", re.IGNORECASE)
_DOC_DATE = re.compile(r"_[0-9]{4}-[0-9]{2}-[0-9]{2}$")
_CITE_ID = re.compile(r"([a-z-]+)_([0-9a-z]+)_([0-9]{4})")
_LEADING_INT = re.compile(r"\s*[+-]?[0-9]+")


@dataclass(frozen=True)
class Regulation:
    id: str
    akn: str                        # the FRBR URI the Akoma Ntoso text is generated under
    type: str
    number: str
    year: int
    title: str                      # "Undang-Undang Nomor 11 Tahun 2008"
    subject: str                    # "" when the record has no ``tentang``
    status: str | None
    tanggal_penetapan: str | None
    tempat_penetapan: str | None
    pejabat_penetapan: str | None
    pemrakarsa: str | None
    source_url: str | None
    source_pdf_url: str | None
    pdf_quality: str | None
    parse_error: str | None
    versions: list[dict]
    relationships: dict[str, list]  # every key present, as ``rel`` in peraturan.ts
    history: dict | None
    folder: Path                    # where the record and its texts are
    archive_url: str | None

    @property
    def path(self) -> str:
        """The law's site path without the leading slash: ``uu/4/2009/``."""
        return f"{self.type}/{self.number}/{self.year}/"

    @property
    def short_cite(self) -> str:
        short = JENIS[self.type][1] if self.type in JENIS else self.type.upper()
        return f"{short} {self.number.upper()}/{self.year}"

    @property
    def text_version(self) -> dict | None:
        """The version the reader shows: the first one with a text file."""
        return next((v for v in self.versions if v.get("text")), None)

    @property
    def has_text(self) -> bool:
        """Whether the text file of ``text_version`` exists."""
        version = self.text_version
        return version is not None and (self.folder / version["text"]).exists()


@dataclass(frozen=True)
class HistoryEvent:
    date: str | None
    kind: str                       # diundangkan | diubah | dicabut | ditetapkan
    by: str | None = None           # the id of the law that did it
    changes: dict | None = None
    order: int | None = None        # diubah: which amendment of the law this is, when it says


def cite_id(law_id: str) -> str:
    """"uu_11_2008" -> "UU 11/2008", "perppu_2_2022" -> "Perppu 2/2022"."""
    m = _CITE_ID.fullmatch(law_id)
    if not m:
        return law_id
    kind = "UU Darurat" if m[1] == "uu-drt" else JENIS[m[1]][1] if m[1] in JENIS else m[1].upper()
    return f"{kind} {m[2].upper()}/{m[3]}"


def source_host(url: str | None) -> str | None:
    return urlsplit(url).hostname if url else None


def source_name(url: str | None) -> str | None:
    host = source_host(url)
    return SOURCE_NAMES.get(host, host) if host else None


def _archive_urls(data_dir: Path) -> dict[str, str]:
    """Archive links per regulation id, from the source manifests."""
    urls: dict[str, str] = {}
    for manifest in sorted((data_dir / "sources" / "manifests").glob("*")):
        for line in manifest.read_text(encoding="utf-8").split("\n"):
            if not line.strip():
                continue
            entry = json.loads(line)
            if entry.get("archive_url") and entry.get("doc_id"):
                urls[_DOC_DATE.sub("", str(entry["doc_id"]))] = entry["archive_url"]
    return urls


def _status(raw: str | None) -> str | None:
    # peraturan.go.id: "Tidak Berlaku Dicabut Oleh : Undang-Undang Nomor 40 Tahun 2007 ..."
    if re.search("dicabut", raw or "", re.IGNORECASE):
        return "dicabut"
    return "tidak_berlaku" if re.search("tidak berlaku", raw or "", re.IGNORECASE) else raw


def _from_record(rec: dict, folder: Path, archived: dict[str, str]) -> Regulation:
    name = JENIS[rec["type"]][0] if rec["type"] in JENIS else rec["type"].upper()
    return Regulation(
        id=rec["id"], akn=rec["akn"], type=rec["type"], number=str(rec["number"]), year=rec["year"],
        title=f"{name} Nomor {str(rec['number']).upper()} Tahun {rec['year']}",
        subject=judul(_CITATION.sub("", rec["tentang"])) if rec["tentang"] else "",
        status=_status(rec["status"]),
        tanggal_penetapan=rec["tanggal_penetapan"], tempat_penetapan=rec["tempat_penetapan"],
        pejabat_penetapan=judul(rec["pejabat_penetapan"]) if rec["pejabat_penetapan"] else None,
        pemrakarsa=judul(rec["pemrakarsa"]) if rec["pemrakarsa"] else None,
        source_url=rec["source_url"], source_pdf_url=rec["source_pdf_url"],
        pdf_quality=rec.get("pdf_quality"), parse_error=rec.get("parse_error"),
        versions=rec["versions"],
        relationships={**_NO_RELATIONS, **(rec["relationships"] or {})},
        history=rec.get("history"), folder=folder, archive_url=archived.get(rec["id"]),
    )


def _leading_int(number: str) -> int:
    """``parseInt(number, 10) || 0``"""
    m = _LEADING_INT.match(number)
    return int(m[0]) if m else 0


def amends_entry(by: Regulation | None, target_id: str) -> dict[str, Any] | None:
    """The entry of ``by``'s ``amends`` list that names ``target_id``."""
    if by is None:
        return None
    return next((a for a in by.relationships["amends"] if a["id"] == target_id), None)


class Regulations:
    """Every law record under ``data/peraturan``, newest first, with lookups by id."""

    def __init__(self, data_dir: Path, types: frozenset[str] | None = SITE_TYPES) -> None:
        """``types``: the record types to read; None reads all."""
        archived = _archive_urls(data_dir)
        found = []
        for path in sorted((data_dir / "peraturan").glob("*/*/*/*.yaml"), key=_by_folders):
            folders = _by_folders(path)
            if path.stem == folders[2] and not folders[0].startswith(".") \
                    and not folders[1].startswith("."):
                rec = load_record(path)
                if types is None or rec["type"] in types:
                    found.append(_from_record(rec, path.parent, archived))
        self.all = sorted(found, key=lambda r: (-r.year, -_leading_int(r.number)))
        self._by_id = {r.id: r for r in self.all}

    def get(self, law_id: str) -> Regulation | None:
        return self._by_id.get(law_id)

    def path_of(self, law_id: str) -> str | None:
        """Site path for a regulation id, if we have its page."""
        law = self.get(law_id)
        return law.path if law else None

    def name_of(self, law_id: str) -> str:
        """"UU 11/2008 tentang Informasi dan Transaksi Elektronik"."""
        law = self.get(law_id)
        return f"{cite_id(law_id)} tentang {law.subject}" if law and law.subject else cite_id(law_id)

    def history(self, law: Regulation) -> list[HistoryEvent]:
        """Everything that happened to a regulation, oldest first: its enactment, each law that
        amended it (with the pasal it changed), revocation, and confirmation of a Perppu."""
        related = law.relationships
        events = [HistoryEvent(law.tanggal_penetapan, "diundangkan")]
        for by_id in related["amended_by"]:
            by = self.get(by_id)
            entry = amends_entry(by, law.id) or {}
            events.append(HistoryEvent(by.tanggal_penetapan if by else None, "diubah", by_id,
                                       entry.get("changes"), entry.get("order")))
        for key, kind in (("revoked_by", "dicabut"), ("enacted_by", "ditetapkan")):
            for by_id in related[key]:
                by = self.get(by_id)
                events.append(HistoryEvent(by.tanggal_penetapan if by else None, kind, by_id))
        return sorted(events, key=lambda e: e.date or "9999")

    def pasal_notes(self, law: Regulation) -> dict[str, list[str]]:
        """Per pasal number: the laws that changed it (for markers in the text)."""
        notes: dict[str, list[str]] = {}
        for event in self.history(law):
            if event.kind != "diubah" or not event.changes:
                continue
            for number in [*(event.changes.get("diubah") or []), *(event.changes.get("dihapus") or [])]:
                notes.setdefault(number, []).append(event.by)
        return notes

    def amendment_count(self, law: Regulation) -> int:
        """How many times a law was amended: the laws we know, or more when an amending law's
        title says so ("perubahan keempat" while we only know two)."""
        orders = []
        for by_id in law.relationships["amended_by"]:
            by = self.get(by_id)
            order = (amends_entry(by, law.id) or {}).get("order")
            orders.append(1 if order is None else order)
        return max(len(law.relationships["amended_by"]), *orders, 0)


def _by_folders(path: Path) -> tuple[str, ...]:
    return path.parts[-4:-1]

