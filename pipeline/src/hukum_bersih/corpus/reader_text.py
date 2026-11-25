"""The text of a law as the reader shows it: the Akoma Ntoso tree cut down to the parts the
page renders, plus the short pasal anchors (``web/src/lib/lawdoc.ts``, ``article-anchors.ts``,
``web-solid/scripts/reader-text.ts``).

The tree comes from the lxml element ``akn.build.to_akn_tree`` makes from the stored Bluebell
text; an element parsed back from the generated XML gives the same tree.
"""

from __future__ import annotations

import re
from collections.abc import Iterator
from dataclasses import dataclass
from typing import Any

from lxml import etree

from .jstext import collapse
from .write import js_object

# the elements the reader keeps; any other child (FRBR metadata, lists of notes) is dropped
_CONTAINERS = frozenset([
    "chapter", "part", "subpart", "article", "paragraph", "point", "item", "blockList", "intro",
    "content", "wrapUp", "mainBody", "body", "preface", "preamble", "conclusions", "p",
])
_NOT_KEY = re.compile(r"[^0-9a-z]+")

Node = dict[str, Any]


def _tag(element: etree._Element) -> str | None:
    """The element's name without its namespace; None for a comment or processing instruction."""
    return etree.QName(element).localname if isinstance(element.tag, str) else None


def _children(element: etree._Element) -> Iterator[tuple[str, etree._Element]]:
    for child in element:
        name = _tag(child)
        if name is not None:
            yield name, child


def _text(element: etree._Element) -> str:
    return collapse("".join(element.itertext()))


def _node(element: etree._Element) -> Node:
    node: Node = {"tag": _tag(element), "children": []}
    if element.get("eId"):
        node["eId"] = element.get("eId")
    if node["tag"] == "p":
        node["text"] = _text(element)
        return node
    for name, child in _children(element):
        if name == "num":
            node["num"] = _text(child)
        elif name == "heading":
            node["heading"] = _text(child)
        elif name in _CONTAINERS:
            node["children"].append(_node(child))
    return node


def _part(root: etree._Element, name: str) -> list[Node]:
    element = next((child for tag, child in _children(root) if tag == name), None)
    return _node(element)["children"] if element is not None else []


def _penjelasan(root: etree._Element) -> list[Node]:
    for attachment in root.iter("{*}attachment"):
        if any(tag == "heading" and _text(child) == "Penjelasan" for tag, child in _children(attachment)):
            main_body = next(attachment.iter("{*}mainBody"), None)
            return _node(main_body)["children"] if main_body is not None else []
    return []


def pasal_key(num: str) -> str:
    """Key used in pasal anchors: "27" -> "27", "45A" -> "45a"."""
    return _NOT_KEY.sub("", num.lower())


def article_aliases(body: list[Node]) -> dict[str, str]:
    """eId of every article -> its short anchor ("pasal-45a"); a repeated number keeps the
    first article's anchor only."""
    aliases: dict[str, str] = {}
    taken: set[str] = set()

    def visit(node: Node) -> None:
        if node["tag"] == "article" and node.get("num") and node.get("eId"):
            alias = f"pasal-{pasal_key(node['num'])}"
            if alias not in taken:
                taken.add(alias)
                aliases[node["eId"]] = alias
        for child in node["children"]:
            visit(child)

    for node in body:
        visit(node)
    return aliases


@dataclass(frozen=True)
class Document:
    """The parts of a law the reader shows, as trees of nodes (``LawDoc`` in lawdoc.ts)."""

    preface: list[Node]
    preamble: list[Node]
    body: list[Node]
    conclusions: list[Node]
    penjelasan: list[Node]


def read_document(document: etree._Element) -> Document:
    """The parts of a law, from the ``akomaNtoso`` element."""
    root = next(child for _, child in _children(document))          # <act> / <bill>
    return Document(_part(root, "preface"), _part(root, "preamble"), _part(root, "body"),
                    _part(root, "conclusions"), _penjelasan(root))


def reader_text_of(document: Document) -> dict[str, Any]:
    """The ``text`` of a law's reader record."""
    return {
        "preface": document.preface,
        "preamble": document.preamble,
        "body": document.body,
        "conclusions": document.conclusions,
        "penjelasan": document.penjelasan,
        "anchors": js_object(article_aliases(document.body).items()),
    }


def reader_text(document: etree._Element) -> dict[str, Any]:
    """The ``text`` of a law's reader record, from the ``akomaNtoso`` element."""
    return reader_text_of(read_document(document))
