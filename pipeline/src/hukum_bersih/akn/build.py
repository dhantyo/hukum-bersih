"""Bluebell text -> Akoma Ntoso XML, using Laws.Africa's bluebell parser."""

from __future__ import annotations

from pathlib import Path

import yaml

LANGUAGE = "ind"


def to_akn(text: str, frbr_uri: str, root: str = "act", expression_date: str | None = None,
           title: str | None = None) -> bytes:
    from bluebell.parser import AkomaNtosoParser
    from cobalt import FrbrUri
    from lxml import etree

    uri = FrbrUri.parse(frbr_uri)
    uri.language = LANGUAGE
    if expression_date:
        uri.expression_date = f"@{expression_date}"
    parser = AkomaNtosoParser(uri)
    xml = parser.parse_to_xml(text, root)
    if title:
        for alias in xml.iter("{*}FRBRalias"):
            if alias.get("name") == "title":
                alias.set("value", title)
    return etree.tostring(xml, encoding="utf-8", pretty_print=True, xml_declaration=True)


def ruu_frbr_uri(slug: str, doc_date: str) -> str:
    """A bill has no number until enacted: /akn/id/bill/<year>/<slug>."""
    return f"/akn/id/bill/{doc_date[:4]}/{slug}"


def build_ruu(data_dir: Path, out_dir: Path) -> list[Path]:
    """Generate Akoma Ntoso XML for every RUU version that has text."""
    written = []
    for record in sorted((data_dir / "ruu").glob("*/ruu.yaml")):
        slug = record.parent.name
        rec = yaml.safe_load(record.read_text())
        for doc in rec.get("documents", []):
            if not doc.get("text"):
                continue
            text = (record.parent / doc["text"]).read_text()
            date = str(doc["date"])
            full_date = date if len(date) == 10 else None
            xml = to_akn(text, ruu_frbr_uri(slug, date), root="bill",
                         expression_date=full_date, title=doc.get("ruu_title") or rec["title"])
            target = out_dir / "ruu" / slug / f"{doc['id']}.xml"
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(xml)
            written.append(target)
    return written
