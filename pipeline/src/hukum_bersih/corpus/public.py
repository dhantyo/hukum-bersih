"""The files of the active release that the browser fetches as static files, written into the
public folder of the web app (``web-solid/public``), which its build copies as it is:

    data/<release>/law-catalog.json     the law catalog the browser searches
    search-index/<release>/...          the Pagefind index

Only the active release is kept: every other release folder under those two is removed, so the
build ships one release and a second run changes nothing.
"""

from __future__ import annotations

import shutil
from pathlib import Path

from .release import RELEASE_ID

CATALOG = "law-catalog.json"
INDEX = "pagefind"
DATA_DIR = "data"
INDEX_DIR = "search-index"


def write_public(stage: Path, public: Path, release: str) -> str:
    """Copy the catalog and the index of ``stage`` into ``public`` under ``release``; returns the
    report line."""
    catalog = public / DATA_DIR / release
    index = public / INDEX_DIR / release
    for target in (catalog, index):
        shutil.rmtree(target, ignore_errors=True)
    catalog.mkdir(parents=True)
    shutil.copy2(stage / CATALOG, catalog / CATALOG)
    shutil.copytree(stage / INDEX, index)
    for parent in (public / DATA_DIR, public / INDEX_DIR):
        _remove_other_releases(parent, release)
    return f"public {public}: release {release}"


def _remove_other_releases(parent: Path, release: str) -> None:
    for entry in parent.iterdir():
        if entry.is_dir() and entry.name != release and RELEASE_ID.fullmatch(entry.name):
            shutil.rmtree(entry)
