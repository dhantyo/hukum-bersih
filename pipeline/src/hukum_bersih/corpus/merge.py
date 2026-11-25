"""The merged text of a law family at one point in time (decision 0010): the base law's text as
enacted, with each amending law's pasal changes applied in order, up to that point
(``web/src/lib/merge.ts``). What could not be applied stays visible: an unreadable new wording
keeps the previous text and is marked.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, replace

from .koleksi import Koleksi
from .laws import Laws
from .pasal import PASAL_NUMBER
from .reader_text import Document, Node
from .regulations import cite_id
from .write import UNDEFINED

_LAST_ART_ID = re.compile(r"art_[^_]+\Z")


@dataclass(frozen=True)
class Merged:
    document: Document
    point: dict
    notes: dict[str, list[dict]]    # per pasal number, oldest first: who changed it and how
    unreadable: dict[str, None]     # pasal whose latest change could not be read (an ordered set)


def _sort_key(num: str) -> tuple[float, str]:
    match = PASAL_NUMBER.fullmatch(num)
    return (int(match[1]), match[2].upper()) if match else (float("inf"), num)


def _before(a: str, b: str) -> bool:
    """Whether pasal ``a`` comes before pasal ``b`` (27 before 27A before 28)."""
    return _sort_key(a) < _sort_key(b)


def lines_to_nodes(lines: list[dict]) -> list[Node]:
    """A pasal's new wording (lines with their numbers and depth) as Akoma Ntoso-like nodes."""
    root: Node = {"tag": "content", "children": []}
    stack = [(root, -1)]
    for line in lines:
        paragraph: Node = {"tag": "p", "text": line["text"], "children": []}
        while len(stack) > 1 and stack[-1][1] >= line["indent"]:
            stack.pop()
        if line["num"]:
            tag = "paragraph" if line["indent"] == 0 and line["num"].startswith("(") else "point"
            node: Node = {"tag": tag, "num": line["num"],
                          "children": [paragraph] if line["text"] else []}
            stack[-1][0]["children"].append(node)
            stack.append((node, line["indent"]))
        else:
            stack[-1][0]["children"].append(paragraph)
    return root["children"]


def _clone(node: Node) -> Node:
    return {**node, "children": [_clone(child) for child in node["children"]]}


def _articles(nodes: list[Node], found: list[tuple[Node, list[Node]]]) -> list[tuple[Node, list[Node]]]:
    """Every article in a tree with its parent's child list, in reading order."""
    for node in nodes:
        if node["tag"] == "article":
            found.append((node, nodes))
        else:
            _articles(node["children"], found)
    return found


def _wording(laws: Laws, change: dict) -> dict | None:
    """The new wording of the pasal that ``change`` made, as its amending law prints it."""
    if change.get("instruction") is None:
        return None
    data = laws.amending_law(change["by"])
    instruction = next((i for i in data["instructions"] if i["n"] == change["instruction"]), None) \
        if data else None
    return next((p for p in instruction["pasal"] if p["num"] == change["pasal"]), None) \
        if instruction else None


def _insert_article(body: list[Node], everything: list[tuple[Node, list[Node]]],
                    pasal: str, children: list[Node]) -> None:
    """A new pasal goes after the last pasal that comes before it (27A after 27), in that BAB."""
    previous = next((a for a in reversed(everything)
                     if a[0].get("num") and _before(a[0]["num"], pasal)), None)
    renamed = f"art_{pasal}"
    previous_id = previous[0].get("eId") if previous else None
    e_id = _LAST_ART_ID.sub(lambda _: renamed, previous_id, count=1) if previous_id else renamed
    node: Node = {"tag": "article", "num": pasal, "eId": e_id, "children": children}
    if previous:
        siblings = previous[1]
        siblings.insert(next(i for i, s in enumerate(siblings) if s is previous[0]) + 1, node)
    else:
        body.append(node)


def merged_doc(laws: Laws, koleksi: Koleksi, point_id: str, original: Document) -> Merged | None:
    """The merged text of ``koleksi`` at history point ``point_id`` (a "gabungan" point);
    None when the point is not one that adds an amendment."""
    history = koleksi.base.history
    points = history["points"] if history else []
    up_to = next((i for i, point in enumerate(points) if point["id"] == point_id), -1)
    if up_to < 1:
        return None
    body = [_clone(node) for node in original.body]
    notes: dict[str, list[dict]] = {}
    unreadable: dict[str, None] = {}
    included = {point["id"] for point in points[1:up_to + 1]}
    for change in (c for c in history["changes"] if c["point"] in included):
        pasal, by = change["pasal"], change["by"]
        everything = _articles(body, [])
        found = next((a[0] for a in everything if a[0].get("num") == pasal), None)
        wording = _wording(laws, change)
        if change["type"] == "dihapus":
            kind = "dihapus"
            if found:
                found["children"] = []
        elif change["wording"] != "read" or not (wording and wording["lines"]):
            kind = "unreadable"
        else:
            children = lines_to_nodes(wording["lines"])
            kind = "disisipkan" if change["type"] == "disisipkan" or not found else "diubah"
            if found:
                found["children"] = children
            else:
                _insert_article(body, everything, pasal, children)
        if kind == "unreadable":
            unreadable[pasal] = None
        else:
            unreadable.pop(pasal, None)
        href = laws.href(by)
        notes.setdefault(pasal, []).append({
            "kind": kind, "label": cite_id(by), "href": UNDEFINED if href is None else href,
            "by": by})
    return Merged(replace(original, body=body), points[up_to], notes, unreadable)
