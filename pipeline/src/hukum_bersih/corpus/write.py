"""One JSON writer whose bytes equal ``JSON.stringify(value)`` plus a newline, which is how the
TypeScript export (``web/scripts/export-*.ts``) wrote every file.

What that means, and what Python does by default instead:

- no spaces after ``,`` and ``:``; no indentation; one trailing newline
- keys stay in insertion order. A JavaScript object lists integer-like keys first, in
  ascending order, whatever the insertion order was: ``js_object`` builds such a dict
- text is written as is (no ``\\uXXXX`` for non-ASCII); control characters are escaped
- ``undefined`` drops an object key and becomes ``null`` in a list: ``UNDEFINED`` does the same
- a number with no fraction is written without ``.0``
"""

from __future__ import annotations

import math
from collections.abc import Iterable
from pathlib import Path
from typing import Any

import orjson


class _Undefined:
    """JavaScript's ``undefined``: a key holding it is left out of the file."""

    def __repr__(self) -> str:
        return "UNDEFINED"


UNDEFINED: Any = _Undefined()

# JSON.stringify prints a float in positional notation from 1e-6 up to 1e21, Python's repr
# from 1e-4 up to 1e16: only the range where both agree is accepted.
_SAME_AS_JS = (1e-4, 1e16)
_MAX_ARRAY_INDEX = 2**32 - 2


def js_object(pairs: Iterable[tuple[str, Any]]) -> dict[str, Any]:
    """A dict in the key order of ``Object.fromEntries(pairs)``: array-index keys ("4", "27")
    first in ascending order, then the other keys as given. A repeated key keeps its first
    place and takes the last value."""
    merged: dict[str, Any] = {}
    for key, value in pairs:
        merged[key] = value
    indexes = sorted((k for k in merged if _is_array_index(k)), key=int)
    others = [k for k in merged if not _is_array_index(k)]
    return {k: merged[k] for k in [*indexes, *others]}


def _is_array_index(key: str) -> bool:
    return (key.isascii() and key.isdigit() and (key == "0" or key[0] != "0")
            and int(key) <= _MAX_ARRAY_INDEX)


def _plain(value: Any) -> Any:
    """``value`` with UNDEFINED removed and whole floats turned into ints; the same object
    when nothing had to change, so a large tree is not copied."""
    if isinstance(value, dict):
        kept = {k: v for k, v in value.items() if v is not UNDEFINED}
        changed = len(kept) != len(value)
        for key, item in kept.items():
            fixed = _plain(item)
            if fixed is not item:
                kept[key] = fixed
                changed = True
        return kept if changed else value
    if isinstance(value, list):
        fixed_items = [_plain(item) for item in value]
        return fixed_items if any(a is not b for a, b in zip(fixed_items, value)) else value
    if value is UNDEFINED:
        return None
    if isinstance(value, float):
        return _number(value)
    return value


def _number(value: float) -> int | float | None:
    if not math.isfinite(value):
        return None                                  # JSON.stringify writes null
    if value.is_integer():
        return int(value)
    if not _SAME_AS_JS[0] <= abs(value) < _SAME_AS_JS[1]:
        raise ValueError(f"{value!r}: Python and JavaScript write this number differently")
    return value


def dumps(value: Any, newline: bool = True) -> str:
    """The text of ``JSON.stringify(value)``, followed by a newline unless ``newline`` is False
    (the export of drafts writes none)."""
    return _encode(value, newline).decode()


def _encode(value: Any, newline: bool) -> bytes:
    """The UTF-8 bytes of ``dumps``. orjson writes compact JSON with the text as is, control
    characters as ``\\b \\f \\n \\r \\t`` or lower-case ``\\u00xx``, and the shortest float that
    reads back, which for the numbers ``_number`` lets through is what ``JSON.stringify`` writes."""
    return orjson.dumps(_plain(value), option=orjson.OPT_APPEND_NEWLINE if newline else 0)


def write_json(path: Path, value: Any, newline: bool = True) -> None:
    """Write ``value`` to a new file (like the export's ``flag: "wx"``), folders included."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("xb") as out:
        out.write(_encode(value, newline))
