"""The ids the reader gives the pieces of a text (``web-solid/src/lib/anchors.ts``): a search
result opens the piece by this id, so the two must stay equal.
"""

from __future__ import annotations

from collections.abc import Mapping

from .reader_text import Node

CONCLUSIONS_ID = "penutup"
EXPLANATION_ID = "penjelasan"


def element_id(node: Node, explanation: bool) -> str | None:
    """The DOM id of a node; Penjelasan nodes carry a prefix so they never clash with the body."""
    if not node.get("eId"):
        return None
    return f"{EXPLANATION_ID}-{node['eId']}" if explanation else node["eId"]


def alias_of(element: str | None, anchors: Mapping[str, str]) -> str | None:
    """The short permalink (``pasal-27``) of an article id, when the text defines one."""
    return anchors.get(element) if element else None
