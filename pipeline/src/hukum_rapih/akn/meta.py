"""Where a law sits, in the meta block of its Akoma Ntoso file (decision 0021; items 1 to 8 of
the feature list in docs/research-mk-relations-2026-11.md), taken from fields its record
already has. A field the record lacks gives no element: nothing here is made up.

The lifecycle follows cobalt's conventions (``eventRef type="amendment"`` or ``"repeal"`` whose
``source`` is a ``passiveRef``), so cobalt's ``Act.amendments`` and ``Act.repeal`` read it."""

from __future__ import annotations

import re
from dataclasses import dataclass

from lxml import etree

from ..corpus.jstext import slugify
from ..corpus.regulations import cite_id
from ..history import took_effect

AGENT = "hukum-rapih"
AGENT_HREF = "https://github.com/dhantyo/hukum-rapih"
PROPRIETARY_NS = AGENT_HREF + "/ns/akn"

# the children of <meta>, in the order the AKN 3.0 schema wants them
META_ORDER = ("identification", "publication", "classification", "lifecycle", "workflow",
              "analysis", "temporalData", "references", "notes", "proprietary", "presentation")

# the lifecycle event (its eId) for each date field of the record
EVENTS = {"tanggal_penetapan": "penetapan", "tanggal_pengundangan": "pengundangan",
          "tanggal_berlaku": "mulai-berlaku"}

# the people and places of the enactment: record field -> TLC element, ontology kind
TLCS = {"pejabat_penetapan": ("TLCPerson", "person"),
        "tempat_penetapan": ("TLCLocation", "location"),
        "pemrakarsa": ("TLCOrganization", "organization")}

# relationships key -> the reference to the other law, the modification and its type.
# A whole-law amendment is a textualMod "substitution" marked incomplete: the pasal it changes
# are not listed (feature 12). Perppu to UU is "conversion" (a decree-law converted into law).
RELATIONS = {"amends": ("activeRef", "textualMod", "substitution"),
             "amended_by": ("passiveRef", "textualMod", "substitution"),
             "revokes": ("activeRef", "textualMod", "repeal"),
             "revoked_by": ("passiveRef", "textualMod", "repeal"),
             "enacts": ("activeRef", "legalSystemMod", "conversion"),
             "enacted_by": ("passiveRef", "legalSystemMod", "conversion")}

# the number in "LN.2008/NO.58", "LN. 1961 No. 8", "LN 2024 (1)"
LN_NUMBER = re.compile(r"\bLN\.?\s*\d{4}\s*(?:/\s*No\.?|No\.?|\()\s*(\d+)", re.IGNORECASE)


@dataclass(frozen=True)
class LawContext:
    """One text version of a law and what its AKN file takes from other files in data/."""
    rec: dict
    version: dict
    short_name: str | None        # the law's name in data/koleksi/
    # for each law in ``revoked_by`` whose record gives it, the full date that law took effect,
    # which is when the revocation takes effect (research-mk-relations-2026-11, Revocations)
    revoked_on: dict[str, str]


def add_context(xml, law: LawContext) -> None:
    """Add the law's context to ``xml``, the tree ``build.to_akn_tree`` made from the text of
    ``law.version``."""
    meta = _Meta(xml)
    rec = law.rec
    meta.ref("TLCOrganization", AGENT, AGENT_HREF, "Hukum Rapih")
    if law.short_name:
        meta.title_alias.addnext(meta.make("FRBRalias", value=law.short_name, name="short"))
    _publication(meta, rec)
    _classification(meta, rec)
    _people_and_places(meta, rec)
    _references(meta, rec)
    _modifications(meta, rec)
    _lifecycle(meta, rec, law.revoked_on)
    _temporal_data(meta, law)
    _proprietary(meta, rec, law.version)
    meta.sort()


class _Meta:
    """The root <meta> of one AKN document and its <references>."""

    def __init__(self, xml) -> None:
        self.ns = etree.QName(xml).namespace
        self.el = xml.find(f"./*/{self.q('meta')}")
        self.references = self.el.find(self.q("references"))
        work, expression = self.q("FRBRWork"), self.q("FRBRExpression")
        self.work_uri = self.el.find(f".//{work}/{self.q('FRBRuri')}").get("value")
        self.expression_uri = self.el.find(f".//{expression}/{self.q('FRBRuri')}").get("value")
        self.title_alias = self.el.find(f".//{work}/{self.q('FRBRalias')}[@name='title']")

    def q(self, tag: str) -> str:
        return f"{{{self.ns}}}{tag}"

    def make(self, tag: str, **attrs: str | None):
        """An element; attributes whose value is None are left out."""
        return etree.Element(self.q(tag), {k: v for k, v in attrs.items() if v is not None})

    def add(self, parent, tag: str, **attrs: str | None):
        child = self.make(tag, **attrs)
        parent.append(child)
        return child

    def block(self, tag: str, source: str = AGENT):
        return self.add(self.el, tag, source=f"#{source}")

    def ref(self, tag: str, eid: str, href: str, show_as: str) -> None:
        self.add(self.references, tag, eId=eid, href=href, showAs=show_as)

    def sort(self) -> None:
        self.el[:] = sorted(self.el, key=lambda e: META_ORDER.index(etree.QName(e).localname))


def _publication(meta: _Meta, rec: dict) -> None:
    ln, date = rec.get("lembaran_negara"), rec.get("tanggal_pengundangan")
    # "LL SETNEG : 5 HLM" alone is the State Secretariat's copy, not a Lembaran Negara
    if not (ln and date and re.match(r"LN\b", ln)):
        return
    number = LN_NUMBER.search(ln)
    meta.add(meta.el, "publication", date=date, name="Lembaran Negara", showAs=ln,
             number=number[1] if number else None)


def _classification(meta: _Meta, rec: dict) -> None:
    if not rec.get("subjek"):
        return
    meta.ref("TLCOrganization", "bpk", "https://peraturan.bpk.go.id", "JDIH BPK")
    block = meta.block("classification", source="bpk")
    for subject in rec["subjek"].split(" - "):      # BPK joins a law's subjects with " - "
        meta.add(block, "keyword", value=subject, showAs=subject, dictionary="#bpk")


def _people_and_places(meta: _Meta, rec: dict) -> None:
    for field, (tag, kind) in TLCS.items():
        if rec.get(field):
            meta.ref(tag, _eid(field), f"/ontology/{kind}/id/{slugify(rec[field])}", rec[field])


def _related(rec: dict) -> list[tuple[str, str]]:
    """(relationships key, law id) for every whole-law relation of the record."""
    rel = rec["relationships"]
    return [(key, law if isinstance(law, str) else law["id"])
            for key in RELATIONS for law in rel.get(key, [])]


def _references(meta: _Meta, rec: dict) -> None:
    """An activeRef or passiveRef for each related law, with the law id as its eId."""
    related = _related(rec)
    amending = [law for p in _points(rec) for law in p.get("after", [])]
    for law in dict.fromkeys([law for _, law in related] + amending):
        kind = next((RELATIONS[key][0] for key, other in related if other == law), "passiveRef")
        meta.ref(kind, law, _work_uri(law), cite_id(law))


def _modifications(meta: _Meta, rec: dict) -> None:
    mods = {"activeRef": [], "passiveRef": []}
    for key, law in _related(rec):
        ref, mod, kind = RELATIONS[key]
        ends = (meta.work_uri, f"#{law}") if ref == "activeRef" else (f"#{law}", meta.work_uri)
        mods[ref].append((mod, kind, *ends))
    if not any(mods.values()):
        return
    analysis = meta.block("analysis")
    for ref, tag, prefix in (("activeRef", "activeModifications", "amod"),
                             ("passiveRef", "passiveModifications", "pmod")):
        if not mods[ref]:
            continue
        block = meta.add(analysis, tag)
        for n, (mod, kind, source, destination) in enumerate(mods[ref], 1):
            el = meta.add(block, mod, eId=f"{prefix}_{n}", type=kind,
                          incomplete="true" if kind == "substitution" else None)
            meta.add(el, "source", href=source)
            meta.add(el, "destination", href=destination)


def _lifecycle(meta: _Meta, rec: dict, revoked_on: dict[str, str]) -> None:
    events = _events(rec, revoked_on)
    if not events:
        return
    meta.ref("original", "original", meta.expression_uri, rec["title"])
    block = meta.block("lifecycle")
    for event in sorted(events, key=lambda e: e["date"]):
        meta.add(block, "eventRef", **event)


def _events(rec: dict, revoked_on: dict[str, str]) -> list[dict]:
    """The attributes of each eventRef: the record's own dates, then each amendment with a
    full date, then the revocation that took effect first."""
    signed = " ".join(f"#{_eid(field)}" for field in ("pejabat_penetapan", "tempat_penetapan")
                      if rec.get(field)) or None
    events = [_event(eid, rec[field], "original") for field, eid in EVENTS.items()
              if rec.get(field)]
    for event in events:
        if event["eId"] == EVENTS["tanggal_penetapan"]:
            event.update(type="generation", refersTo=signed)
    events += [_event(_amendment(law), point["date"], law, "amendment")
               for point in _points(rec) if point["kind"] == "gabungan" and _full(point["date"])
               for law in point["after"]]
    repeal = _repeal(revoked_on)
    if repeal:
        events.append(_event(_repeal_eid(repeal), revoked_on[repeal], repeal, "repeal"))
    return events


def _event(eid: str, date: str, source: str, kind: str | None = None) -> dict:
    return {"eId": eid, "date": date, "source": f"#{source}", "type": kind}


def _temporal_data(meta: _Meta, law: LawContext) -> None:
    """When each version was in force: from the event it starts at to the one the next
    version starts at. A version whose start or end is not known gets no interval."""
    rec = law.rec
    points = _points(rec) or [{"id": law.version["id"], "kind": "asli",
                               "date_basis": took_effect(rec)[1]}]
    starts = [_start(p) for p in points]
    repeal = _repeal(law.revoked_on)
    # the last version ends at the revocation; with none, it is open only while still in force
    last_end = _repeal_eid(repeal) if repeal else None
    ends = starts[1:] + [last_end]
    in_force = rec.get("status") == "berlaku" and not rec["relationships"]["revoked_by"]
    last = len(points) - 1
    intervals = [(p["id"], start, end)
                 for i, (p, start, end) in enumerate(zip(points, starts, ends))
                 if start and (end or (i == last and in_force))]
    if not intervals:
        return
    meta.ref("TLCConcept", "berlaku", "/ontology/concept/id/berlaku", "Berlaku")
    block = meta.block("temporalData")
    for eid, start, end in intervals:
        group = meta.add(block, "temporalGroup", eId=eid)
        meta.add(group, "timeInterval", start=f"#{start}", end=f"#{end}" if end else None,
                 refersTo="#berlaku")


def _proprietary(meta: _Meta, rec: dict, version: dict) -> None:
    attrs = {"id": rec["id"], "version": version["id"], "source_url": rec.get("source_url"),
             "source_pdf_url": rec.get("source_pdf_url"), "pdf_sha256": version.get("pdf_sha256"),
             "bpk_id": str(rec["bpk"]["id"]) if rec.get("bpk") else None}
    block = meta.block("proprietary")
    known = {k: v for k, v in attrs.items() if v is not None}
    etree.SubElement(block, f"{{{PROPRIETARY_NS}}}record", known, nsmap={"hr": PROPRIETARY_NS})


def _points(rec: dict) -> list[dict]:
    return (rec.get("history") or {}).get("points") or []


def _start(point: dict) -> str | None:
    """The lifecycle event a history point starts at."""
    if point["kind"] == "gabungan":
        return _amendment(point["after"][0]) if _full(point["date"]) else None
    return EVENTS.get(point["date_basis"])


def _repeal(revoked_on: dict[str, str]) -> str | None:
    """The revoking law whose revocation took effect first."""
    return min(revoked_on, key=revoked_on.get) if revoked_on else None


def _amendment(law: str) -> str:
    return f"diubah-{law}"


def _repeal_eid(law: str) -> str:
    return f"dicabut-{law}"


def _eid(field: str) -> str:
    return field.replace("_", "-")


def _full(date: str | None) -> bool:
    return bool(date) and len(date) == 10


def _work_uri(law: str) -> str:
    """The FRBR Work URI of a law id ("uu_11_2008"), built as the importers build ``akn``."""
    jenis, nomor, tahun = law.split("_")
    return f"/akn/id/act/{jenis}/{tahun}/{nomor}"
