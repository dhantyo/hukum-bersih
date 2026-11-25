"""``drafts/<slug>/``: the record of each RUU, the text of each version that has one, and the
comparison of every pair of those versions (``web-solid/scripts/export-drafts.ts`` and
``draft-comparison.ts``, with ``web/src/lib/data.ts`` for reading ``data/ruu``).

JavaScript wrote these files without a final newline.
"""

from __future__ import annotations

import datetime
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

from ..akn.build import ruu_akn_args, to_akn_tree
from .compare import Comparison, PasalComparison, compare, line_json
from .jstext import locale_key
from .pasal import Pasal, collect_pasal
from .reader_text import reader_text
from .search import SearchRecords
from .titles import draft_document_title
from .write import UNDEFINED, write_json

# a row below this similarity is flagged "weak": paired, but barely alike
WEAK_SIMILARITY = 0.34

_SLUG = re.compile(r"[a-z0-9-]+")
_DOCUMENT_ID = re.compile(r"[a-z0-9_-]+")
_PAIR = re.compile(f"{_DOCUMENT_ID.pattern}\\.\\.\\.{_DOCUMENT_ID.pattern}")
_METADATA_KEYS = ("id", "type", "label", "date", "provenance", "obtained_by", "source_url",
                  "archive_url", "note", "ruu_title")


@dataclass
class Text:
    """One version's text: what the reader page shows, and its pasal for comparing."""

    reader: dict[str, Any]
    pasal: list[Pasal]


def _as_text(value: Any) -> str:
    """YAML turns 2026-11-19 into a date and 2008 into a number: keep dates as written."""
    if isinstance(value, datetime.date):
        return value.isoformat()
    return "" if value is None else str(value)


def load_ruus(data_dir: Path) -> list[dict[str, Any]]:
    """Every ``data/ruu/<slug>/ruu.yaml``, by title."""
    bills = []
    for record in (data_dir / "ruu").glob("*/ruu.yaml"):
        rec = yaml.safe_load(record.read_text(encoding="utf-8"))
        rec["slug"] = record.parent.name
        rec["stages"] = [{**s, "date": _as_text(s.get("date"))} for s in rec.get("stages") or []]
        rec["documents"] = [{**d, "date": _as_text(d.get("date"))}
                            for d in rec.get("documents") or []]
        bills.append(rec)
    return sorted(bills, key=lambda bill: locale_key(bill["title"]))


def versions(bill: dict[str, Any]) -> list[dict[str, Any]]:
    """The documents that have a text, oldest first."""
    return sorted((d for d in bill["documents"] if d.get("text")), key=lambda d: d["date"])


def _load_text(data_dir: Path, bill: dict[str, Any], document: dict[str, Any]) -> Text:
    text = (data_dir / "ruu" / bill["slug"] / document["text"]).read_text(encoding="utf-8")
    tree = reader_text(to_akn_tree(text, **ruu_akn_args(bill["slug"], bill, document)))
    return Text(tree, collect_pasal(tree["body"]))


def _metadata(document: dict[str, Any]) -> dict[str, Any]:
    return {**{key: document.get(key, UNDEFINED) for key in _METADATA_KEYS},
            "hasText": bool(document.get("text"))}


# --- the rows of a comparison ------------------------------------------------------------

def _anchor_of(row: PasalComparison) -> str:
    pasal = row.b or row.a
    if pasal is None:
        raise ValueError("A comparison row has no pasal on either side")
    return f"{'b' if row.b else 'a'}-{pasal.eId}"


def comparison_rows(comparison: Comparison) -> list[dict[str, Any]]:
    """The rows as the page reads them: anchors for pasal and for the pasal a line points at."""
    anchors = {id(pasal): _anchor_of(row)
               for row in comparison.rows for pasal in (row.a, row.b) if pasal}
    chapter: str | None = None
    out = []
    for row in comparison.rows:
        heading = row.b.chapter if row.b else None
        new_chapter = heading if heading is not None and heading != chapter else None
        chapter = new_chapter if new_chapter is not None else chapter
        out.append({
            "anchor": _anchor_of(row), "status": row.status, "renumbered": row.renumbered,
            "moved": row.moved,
            "weak": (row.a is not None and row.b is not None and row.status == "berubah"
                     and row.similarity < WEAK_SIMILARITY),
            "chapter": UNDEFINED if new_chapter is None else new_chapter,
            "a": {"label": row.a.label} if row.a else UNDEFINED,
            "b": {"label": row.b.label} if row.b else UNDEFINED,
            "lines": [line_json(line, anchors) for line in row.lines],
        })
    return out


# --- the files ---------------------------------------------------------------------------

def _check(pattern: re.Pattern[str], value: str) -> str:
    if not pattern.fullmatch(value):
        raise ValueError(f"{value!r} is not a valid name for a file")
    return value


def _export_draft(data_dir: Path, bill: dict[str, Any], root: Path, search: SearchRecords) -> None:
    directory = root / _check(_SLUG, bill["slug"])
    (directory / "documents").mkdir(parents=True)
    (directory / "comparisons").mkdir()
    short_name = bill.get("short_name")
    name = bill["title"] if short_name is None else short_name

    write_json(directory / "index.json",
               {**bill, "name": name, "documents": [_metadata(d) for d in bill["documents"]]},
               newline=False)

    documents = versions(bill)
    texts = {d["id"]: _load_text(data_dir, bill, d) for d in documents}
    _write_documents(directory / "documents", bill, name, documents, texts)
    _write_comparisons(directory / "comparisons", bill, name, documents, texts)
    for document in documents:
        page = f"/ruu/{bill['slug']}/{document['id']}/"
        search.add_draft_document(bill["slug"], page, draft_document_title(document),
                                  texts[document["id"]].reader)


def _write_documents(directory: Path, bill: dict[str, Any], name: str,
                     documents: list[dict[str, Any]], texts: dict[str, Text]) -> None:
    for document in documents:
        write_json(directory / f"{_check(_DOCUMENT_ID, document['id'])}.json",
                   {"name": name, "title": bill["title"], "document": _metadata(document),
                    "text": texts[document["id"]].reader}, newline=False)


def _write_comparisons(directory: Path, bill: dict[str, Any], name: str,
                       documents: list[dict[str, Any]], texts: dict[str, Text]) -> None:
    """Every older version against every newer one."""
    for index, older in enumerate(documents):
        for newer in documents[index + 1:]:
            comparison = compare(texts[older["id"]].pasal, texts[newer["id"]].pasal)
            pair = _check(_PAIR, f"{older['id']}...{newer['id']}")
            write_json(directory / f"{pair}.json",
                       {"name": name, "title": bill["title"], "older": _metadata(older),
                        "newer": _metadata(newer), "counts": comparison.counts,
                        "rows": comparison_rows(comparison)}, newline=False)


def export_drafts(data_dir: Path, stage: Path, search: SearchRecords) -> str:
    """Write ``drafts/`` for every RUU into ``stage``, and add the texts to ``search``."""
    bills = load_ruus(data_dir)
    for bill in bills:
        _export_draft(data_dir, bill, stage / "drafts", search)
    return f"Exported {len(bills)} drafts"
