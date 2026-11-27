"""Wayback Machine (web.archive.org) copies of documents that vanished from official sites."""

from __future__ import annotations

import re

WAYBACK_RE = re.compile(r"^https?://web\.archive\.org/web/(\d+)(?:id_)?/(.+)$")


def raw_url(url: str) -> str:
    """Wayback URLs serve an HTML wrapper unless the timestamp carries the ``id_`` flag."""
    m = WAYBACK_RE.match(url)
    return f"https://web.archive.org/web/{m.group(1)}id_/{m.group(2)}" if m else url


def original_url(url: str) -> str:
    """The URL that was archived (for a Wayback URL), else the URL itself."""
    m = WAYBACK_RE.match(url)
    return m.group(2) if m else url
