"""Every pasal an amended law's amendments changed, version by version: the data of
``/koleksi/<slug>/perubahan.json`` (``versionHistory`` and ``compareData`` in
``web/src/lib/amendments.ts``). The word diffs the website computes from the same steps are
not part of this data.
"""

from __future__ import annotations

from typing import Any

from .jstext import locale_key
from .laws import Laws
from .pasal import PASAL_NUMBER, collect_pasal
from .reader_text import Document
from .regulations import Regulation, cite_id

# a pasal in one version: its lines as [number, text, indent], "d" (deleted) or "u" (its new
# wording is not readable)
Slot = list[list] | str


def _number_order(num: str) -> tuple[int, tuple]:
    """The order of pasal numbers in the data: 27 before 27A before 28. Ties on the number
    are broken as ``localeCompare`` does, like the website."""
    match = PASAL_NUMBER.fullmatch(num)
    if match is None:
        raise ValueError(f"Pasal number {num!r} does not start with a digit")
    return int(match[1]), locale_key(match[2])


def _line(num: str | None, text: str, indent: int) -> list:
    return [num, text, indent]


def compare_data(laws: Laws, base: Regulation, original: Document) -> dict[str, Any]:
    """The versions of ``base`` (as enacted, then one per readable amendment) and, per pasal an
    amendment touched, how it reads in the original and after each version that changed it."""
    amendments = laws.readable_amendments(base)
    versions = [{"id": base.id, "label": f"Teks asli ({base.year})", "cite": cite_id(base.id),
                 "date": base.tanggal_penetapan, "gap": 0}]
    states: list[dict[str, Slot]] = [
        {p.num: [_line(line.num, line.text, line.indent) for line in p.lines]
         for p in collect_pasal(original.body)}]
    changed_in: dict[str, list[int]] = {}
    for k, amendment in enumerate(amendments):
        state = dict(states[k])
        for instruction in amendment.data["instructions"]:
            for p in instruction["pasal"]:
                if p["kind"] == "dihapus":
                    state[p["num"]] = "d"
                elif p["text"]:
                    state[p["num"]] = [_line(line["num"], line["text"], line["indent"])
                                       for line in p["lines"]]
                else:
                    state[p["num"]] = "u"
                changed_in.setdefault(p["num"], []).append(k + 1)
        versions.append({"id": amendment.by, "label": cite_id(amendment.by),
                         "cite": cite_id(amendment.by), "date": amendment.date,
                         "gap": amendment.gap})
        states.append(state)
    return {
        "versions": versions,
        "pasal": [[num, [[k, states[k].get(num)] for k in [0, *changed_in[num]]]]
                  for num in sorted(changed_in, key=_number_order)],
    }
