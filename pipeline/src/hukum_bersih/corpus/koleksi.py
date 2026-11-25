"""Collections ("koleksi"): a law, the laws that amend it and the laws it replaced, under the
name people use for them ("UU ITE") (``web/src/lib/koleksi.ts``). Named ones come from
``data/koleksi/*.yaml``; every other amended law gets an unnamed collection titled after its
subject. Members are derived from the relationships in the law records.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from ..yamlio import load_yaml
from .jstext import locale_key, slugify
from .regulations import Regulation, Regulations, amends_entry, cite_id

ORDINALS = ["", "pertama", "kedua", "ketiga", "keempat", "kelima", "keenam", "ketujuh",
             "kedelapan", "kesembilan", "kesepuluh"]

Role = Literal["pokok", "perubahan", "pendahulu"]


def ordinal(n: int) -> str:
    return ORDINALS[n] if 0 <= n < len(ORDINALS) else f"ke-{n}"


@dataclass(frozen=True)
class Koleksi:
    slug: str
    name: str                # "UU ITE"; for unnamed ones the subject
    named: bool              # has a common short name (a file in data/koleksi)
    base: Regulation
    title: str = ""          # "Informasi dan Transaksi Elektronik"
    aliases: tuple[str, ...] = ()

    @property
    def path(self) -> str:
        return f"koleksi/{self.slug}/"


@dataclass(frozen=True)
class Member:
    id: str
    law: Regulation | None   # None: named in the relations but not in data/
    role: Role
    order: int | None = None  # for amendments: 1 = pertama ...


@dataclass(frozen=True)
class TimelineEvent:
    kind: str                # pendahulu | pokok | perubahan | dicabut | ditetapkan-dari | tidak-tersedia
    law: Regulation | None = None
    order: int = 0
    what: str = ""           # tidak-tersedia: what is missing
    id: str | None = None
    why: str = ""


def _not_imported(law_id: str) -> str:
    if law_id.startswith("perppu_"):
        return "Perppu belum kami impor; baru undang-undang yang tersedia."
    if law_id.startswith("uu-drt_"):
        return "Undang-undang darurat belum kami impor."
    return "Disebut dalam data sumber, tetapi belum ada di koleksi kami."


class Collections:
    """Every collection, named ones first, and the collection each law belongs to."""

    def __init__(self, data_dir: Path, regulations: Regulations) -> None:
        self.regulations = regulations
        self._extra_members: dict[str, list[str]] = {}
        named = self._named(data_dir / "koleksi")
        taken = {k.base.id for k in named}
        slugs = {k.slug for k in named}
        unnamed = []
        for law in regulations.all:
            relations = law.relationships
            if law.id in taken or not relations["amended_by"] or relations["amends"]:
                continue
            slug = slugify(law.subject or law.id) or law.id
            if slug in slugs:
                slug = f"{slug}-{law.year}"
            slugs.add(slug)
            unnamed.append(Koleksi(slug, law.subject or law.title, False, law, law.subject))
        self.all = [*named, *sorted(unnamed, key=lambda k: locale_key(k.name))]
        self._of: dict[str, Koleksi] = {}
        for koleksi in self.all:
            for member in self.members(koleksi):
                self._of.setdefault(member.id, koleksi)

    def _named(self, folder: Path) -> list[Koleksi]:
        found = []
        for path in sorted(folder.glob("*.yaml")) if folder.exists() else []:
            data = load_yaml(path.read_text(encoding="utf-8"))
            base = self.regulations.get(data["base"])
            if base is None:
                continue
            found.append(Koleksi(data["slug"], data["name"], True, base,
                                 base.subject if data.get("title") is None else data["title"],
                                 tuple(data.get("aliases") or ())))
            self._extra_members[data["slug"]] = data.get("members") or []
        return sorted(found, key=lambda k: locale_key(k.name))

    def of(self, law_id: str) -> Koleksi | None:
        """The collection a law belongs to (as base, amendment or replaced law)."""
        return self._of.get(law_id)

    def members(self, koleksi: Koleksi) -> list[Member]:
        """The laws in a collection: replaced laws first, then the base law and its amendments
        by date."""
        regs = self.regulations
        relations = koleksi.base.relationships

        def date(law_id: str) -> str:
            law = regs.get(law_id)
            return (law.tanggal_penetapan or str(law.year)) if law else ""

        predecessors = sorted(dict.fromkeys([*relations["revokes"],
                                             *self._extra_members.get(koleksi.slug, [])]), key=date)
        amendments = []
        number = 0
        for law_id in relations["amended_by"]:
            order = (amends_entry(regs.get(law_id), koleksi.base.id) or {}).get("order")
            number = order if order is not None else number + 1
            amendments.append(Member(law_id, regs.get(law_id), "perubahan", number))
        return [*(Member(i, regs.get(i), "pendahulu") for i in predecessors),
                Member(koleksi.base.id, koleksi.base, "pokok"), *amendments]

    def timeline(self, koleksi: Koleksi) -> list[TimelineEvent]:
        """Everything that happened to the collection, oldest first, with what we lack marked."""
        regs, base = self.regulations, koleksi.base
        out: list[TimelineEvent] = []
        members = self.members(koleksi)
        for m in (m for m in members if m.role == "pendahulu"):
            out.append(TimelineEvent("pendahulu", m.law) if m.law else TimelineEvent(
                "tidak-tersedia", what="Undang-undang yang digantikan", id=m.id,
                why=_not_imported(m.id)))
        for law_id in base.relationships["enacts"]:
            law = regs.get(law_id)
            out.append(TimelineEvent("ditetapkan-dari", law) if law else TimelineEvent(
                "tidak-tersedia", what="Perppu yang ditetapkan menjadi undang-undang ini",
                id=law_id, why=_not_imported(law_id)))
        out.append(TimelineEvent("pokok", base))
        seen = 0
        for m in (m for m in members if m.role == "perubahan"):
            order = m.order if m.order is not None else seen + 1
            for n in range(seen + 1, order):
                out.append(TimelineEvent(
                    "tidak-tersedia", what=f"Perubahan {ordinal(n)}",
                    why=f"Judul {cite_id(m.id)} menyebut dirinya perubahan {ordinal(order)}, jadi "
                        "ada perubahan sebelumnya yang belum tercatat di sini. Biasanya melalui "
                        "undang-undang yang mengubah banyak undang-undang sekaligus, seperti UU "
                        "Cipta Kerja."))
            seen = max(seen + 1, order)
            out.append(TimelineEvent("perubahan", m.law, order) if m.law else TimelineEvent(
                "tidak-tersedia", what=f"Perubahan {ordinal(order)}", id=m.id,
                why=_not_imported(m.id)))
        for law_id in base.relationships["revoked_by"]:
            law = regs.get(law_id)
            out.append(TimelineEvent("dicabut", law) if law else TimelineEvent(
                "tidak-tersedia", what="Undang-undang yang mencabut", id=law_id,
                why=_not_imported(law_id)))
        return out

    def role_label(self, koleksi: Koleksi, law_id: str) -> str:
        """A law's place in its collection, for the box on its own page."""
        if koleksi.base.id == law_id:
            return "Undang-undang pokok"
        member = next((m for m in self.members(koleksi) if m.id == law_id), None)
        if member and member.role == "perubahan":
            return f"Perubahan {ordinal(member.order if member.order is not None else 1)}"
        return "Digantikan" if member and member.role == "pendahulu" else "Terkait"
