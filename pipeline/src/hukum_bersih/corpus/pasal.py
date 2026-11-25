"""A pasal as lines (one per ayat, huruf or angka): the shape two versions are compared in
(``web/src/lib/lawtext.ts`` and the pasal part of ``lawdoc.ts``), built from the reader tree of
``reader_text.py``.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

Node = dict[str, Any]

_NUMBERED = frozenset(["paragraph", "point", "item"])


@dataclass(eq=False)
class PasalLine:
    """One ayat, huruf, angka or sentence. ``num`` ("(1)", "a.") is kept apart from the text;
    ``indent`` counts the numbered levels around the line. Lines are compared by identity."""

    text: str
    indent: int
    num: str | None = None


@dataclass(eq=False)
class Pasal:
    """``label`` is "Pasal 5", ``eId`` "chp_III__art_5", ``chapter`` "BAB III". Compared by identity."""

    label: str
    num: str
    eId: str
    chapter: str | None
    lines: list[PasalLine] = field(default_factory=list)


def line_text(line: PasalLine) -> str:
    return f"{line.num} {line.text}" if line.num else line.text


def pasal_text(pasal: Pasal) -> str:
    return "\n".join("  " * line.indent + line_text(line) for line in pasal.lines)


def _js(value: Any) -> str:
    """A template literal prints a missing value as ``undefined``."""
    return "undefined" if value is None else str(value)


def _flatten(article: Node) -> list[PasalLine]:
    """One article as lines. A numbered element's first sentence carries its number; further
    sentences inside it are indented to line up with that sentence's text."""
    lines: list[PasalLine] = []

    def walk(node: Node, depth: int, pending: str | None = None) -> str | None:
        # ``pending``: a number not yet attached to text
        for child in node["children"]:
            if child["tag"] == "p":
                if pending is not None:
                    lines.append(PasalLine(child.get("text", ""), depth - 1, pending))
                    pending = None
                else:
                    lines.append(PasalLine(child.get("text", ""), depth))
            elif child["tag"] in _NUMBERED:
                if pending is not None:
                    lines.append(PasalLine("", depth - 1, pending))
                    pending = None
                rest = walk(child, depth + 1, child.get("num"))
                if rest is not None:
                    lines.append(PasalLine("", depth, rest))
            else:
                pending = walk(child, depth, pending)       # intro / content / wrapUp
        return pending

    walk(article, 0)
    return lines


def collect_pasal(nodes: list[Node], chapter: str | None = None,
                  out: list[Pasal] | None = None) -> list[Pasal]:
    """Every article of a reader tree in reading order, each with the chapter it sits in."""
    out = [] if out is None else out
    for node in nodes:
        if node["tag"] == "article":
            out.append(Pasal(f"Pasal {_js(node.get('num'))}", node.get("num") or "",
                             node.get("eId") or "", chapter, _flatten(node)))
        elif node["tag"] != "p":
            nested = f"BAB {_js(node.get('num'))}" if node["tag"] == "chapter" else chapter
            collect_pasal(node["children"], nested, out)
    return out
