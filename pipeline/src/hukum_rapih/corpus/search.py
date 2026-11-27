"""The full-text search records of the reader pages and the Pagefind index built from them
(``web/scripts/search-records.ts`` and ``index-corpus.ts``).

One record per piece a result can open: the opening, each pasal, the closing, and each piece of
the Penjelasan that says more than "Cukup jelas". Its URL is the id the reader gives that piece
(``anchors.py``), so a result opens the exact pasal.

Pagefind numbers its pages in the order it receives them, so that order is part of the output.
The TypeScript export took it from ``glob`` on the folders of the stage: the laws by path,
last first, then the drafts. ``SearchRecords`` keeps that order, whatever order the pages are
added in.
"""

from __future__ import annotations

import os
import re
import shutil
import tempfile
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import regex

from .anchors import CONCLUSIONS_ID, EXPLANATION_ID, alias_of, element_id
from .jstext import WS, collapse, trim
from .pagefind_index import Record, write_index
from .reader_text import Node

_SEARCHABLE = regex.compile(r"[\p{L}\p{N}]")
# JavaScript's /i without /u folds only ASCII letters; Python's would also fold "ſ" into "s"
_CUKUP_JELAS = re.compile(rf"cukup{WS}+jelas\.?", re.IGNORECASE | re.ASCII)
_EXPLANATION_TITLE = re.compile("penjelasan", re.IGNORECASE)


def _words(node: Node) -> list[str]:
    if node["tag"] == "p":
        return [node.get("text", "")]
    own = [node.get("num"), node.get("heading")]
    return [w for w in [*own, *(w for child in node["children"] for w in _words(child))] if w]


def _join(nodes: list[Node]) -> str:
    return collapse(" ".join(w for node in nodes for w in _words(node)))


def _has_article(node: Node) -> bool:
    return node["tag"] == "article" or any(_has_article(child) for child in node["children"])


def _articles(nodes: list[Node]) -> Iterator[Node]:
    for node in nodes:
        if node["tag"] == "article":
            yield node
        else:
            yield from _articles(node["children"])


def _paragraphs(node: Node) -> list[str]:
    if node["tag"] == "p":
        return [node.get("text", "")]
    return [t for child in node["children"] for t in _paragraphs(child)]


def _cukup_jelas(node: Node) -> bool:
    """True when everything a Penjelasan entry says is "Cukup jelas."."""
    said = [t for t in _paragraphs(node) if trim(t)]
    return bool(said) and all(_CUKUP_JELAS.fullmatch(trim(t)) for t in said)


def _explanation_nodes(nodes: list[Node]) -> Iterator[Node]:
    for node in nodes:
        if node["tag"] == "article":
            if not _cukup_jelas(node):
                yield node
        elif _has_article(node):
            yield from _explanation_nodes(node["children"])
        else:
            yield node


def _article_label(node: Node) -> str:
    return trim(f"Pasal {node.get('num', '')}")


def _block_label(node: Node) -> str:
    name = " ".join(part for part in (node.get("num"), node.get("heading")) if part)
    if name and not _EXPLANATION_TITLE.fullmatch(name):
        return f"Penjelasan {name}"
    return "Penjelasan"


def text_records(page: str, title: str, text: dict[str, Any]) -> list[Record]:
    """The records of one page's reader text, in the order of the page; ``title`` is its heading."""
    anchors = text["anchors"]

    def record(anchor: str | None, label: str, content: str) -> list[Record]:
        if not _SEARCHABLE.search(content):
            return []
        return [Record(f"{page}#{anchor}" if anchor else page, content, title, label)]

    articles = []
    for node in _articles(text["body"]):
        element = element_id(node, False)
        articles += record(alias_of(element, anchors) or element, _article_label(node),
                           f"{_article_label(node)}. {_join(node['children'])}")

    explanations = []
    for node in _explanation_nodes(text["penjelasan"]):
        anchor = element_id(node, True) or EXPLANATION_ID
        if node["tag"] == "article":
            explanations += record(anchor, f"{_article_label(node)} Penjelasan",
                                   f"{_article_label(node)}. {_join(node['children'])}")
        else:
            explanations += record(anchor, _block_label(node), _join([node]))

    return [
        *record(None, "Pembukaan", _join([*text["preface"], *text["preamble"]])),
        *articles,
        *record(CONCLUSIONS_ID, "Pengesahan dan pengundangan", _join(text["conclusions"])),
        *explanations,
    ]


class SearchRecords:
    """The records of the pages exported so far, in the order Pagefind indexes them."""

    def __init__(self) -> None:
        self._laws: dict[str, list[Record]] = {}          # by page
        self._drafts: dict[str, list[Record]] = {}        # by draft slug, in document order
        self.pages = 0

    def add_law(self, page: str, title: str, text: dict[str, Any]) -> None:
        self._laws[page] = text_records(page, title, text)
        self.pages += 1

    def add_draft_document(self, slug: str, page: str, title: str, text: dict[str, Any]) -> None:
        self._drafts.setdefault(slug, []).extend(text_records(page, title, text))
        self.pages += 1

    def __iter__(self) -> Iterator[Record]:
        for page in sorted(self._laws, reverse=True):
            yield from self._laws[page]
        for slug in sorted(self._drafts, reverse=True):
            yield from self._drafts[slug]

    def write(self, stage: Path) -> str:
        """Write ``stage/pagefind``; returns the report line."""
        if not self._laws:
            raise ValueError("The release has no law documents to index")
        scratch = Path(tempfile.mkdtemp(prefix=".pagefind-", dir=stage))
        try:
            write_index(self, scratch)
            os.rename(scratch, stage / "pagefind")
        finally:
            shutil.rmtree(scratch, ignore_errors=True)
        count = sum(len(r) for r in [*self._laws.values(), *self._drafts.values()])
        return f"Indexed {count} records from {self.pages} documents"
