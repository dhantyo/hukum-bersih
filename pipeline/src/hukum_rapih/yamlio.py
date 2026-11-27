"""Read YAML with libyaml's C parser, which PyYAML ships in its wheels.

``yaml.safe_load`` parses in pure Python and takes about ten times longer over the 2,000 files
of ``data/``. ``CSafeLoader`` gives the same values; the plain ``SafeLoader`` stands in where a
PyYAML build has no libyaml."""

from __future__ import annotations

from typing import Any

import yaml

_Loader = getattr(yaml, "CSafeLoader", yaml.SafeLoader)


def load_yaml(text: str) -> Any:
    """The value of the YAML document ``text``, as ``yaml.safe_load`` reads it."""
    return yaml.load(text, Loader=_Loader)
