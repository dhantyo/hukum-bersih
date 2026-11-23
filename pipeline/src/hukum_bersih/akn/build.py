"""Bluebell text -> Akoma Ntoso XML, using Laws.Africa's bluebell parser."""

from __future__ import annotations

from pathlib import Path

import yaml

LANGUAGE = "ind"


class LeakedMarkupError(ValueError):
    """Bluebell markup ended up as visible text: the source text is malformed (usually a
    POINT/PARA indented at the wrong depth)."""


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
    _check_no_leaked_markup(xml)
    if title:
        for alias in xml.iter("{*}FRBRalias"):
            if alias.get("name") == "title":
                alias.set("value", title)
    return etree.tostring(xml, encoding="utf-8", pretty_print=True, xml_declaration=True)


def _check_no_leaked_markup(xml) -> None:
    import re

    from .bluebell import KEYWORDS

    # markup shows as a keyword then a space or the end ("ART 1 -", "POINT (a)", "BODY"); a
    # keyword-like word in the law's own text is not ("TR: Tegangan Rendah", UU 59/2024)
    leaked = re.compile(rf"^(?:{'|'.join(sorted(KEYWORDS, key=len, reverse=True))})(?:\s|$)")
    for p in xml.iter("{*}p"):
        text = "".join(p.itertext()).strip()
        if leaked.match(text):
            raise LeakedMarkupError(f"{p.get('eId')}: markup in text: {text[:80]!r}")


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


def _build_version(args: tuple[str, str, str | None, str, str]) -> str | None:
    text_path, akn, date, title, target = args
    target_path = Path(target)
    source = Path(text_path)
    if target_path.exists() and target_path.stat().st_mtime >= source.stat().st_mtime:
        return target                                    # up to date
    try:
        xml = to_akn(source.read_text(), akn, "act", expression_date=date, title=title)
    except Exception as e:  # noqa: BLE001 - one bad text must not stop the site build
        print(f"skip {source.name}: {type(e).__name__}: {str(e)[:120]}")
        return None
    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_bytes(xml)
    return target


def build_peraturan(data_dir: Path, out_dir: Path) -> list[Path]:
    """Generate Akoma Ntoso XML for every regulation text version (in parallel; unchanged
    texts are skipped)."""
    from concurrent.futures import ProcessPoolExecutor

    from ..naming import PUBLISHED_TYPES

    jobs = []
    for record in sorted(p for jenis in PUBLISHED_TYPES
                         for p in (data_dir / "peraturan" / jenis).glob("*/*/*.yaml")):
        rec = yaml.safe_load(record.read_text())
        rel = record.parent.relative_to(data_dir / "peraturan")
        for v in rec.get("versions") or []:
            if not v.get("text"):
                continue
            date = v.get("date")
            jobs.append((str(record.parent / v["text"]), rec["akn"],
                         date if date and len(str(date)) == 10 else None, rec.get("title"),
                         str(out_dir / "peraturan" / rel / f"{v['id']}.xml")))
    with ProcessPoolExecutor() as pool:
        return [Path(t) for t in pool.map(_build_version, jobs, chunksize=16) if t]
