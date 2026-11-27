"""``hukum-rapih export-corpus``: every area of the web corpus, in order, into a stage, and with
``--publish`` the stage stored as a release in a corpus folder."""

from __future__ import annotations

import shutil
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from .catalog import export_catalog
from .collection_export import export_collections
from .drafts import export_drafts
from .laws import Laws, export_laws
from .public import write_public
from .release import publish
from .search import SearchRecords


def export_corpus(
    data_dir: Path, stage: Path | None, corpus: Path | None = None, public: Path | None = None
) -> list[str]:
    """Write the corpus built from ``data_dir`` into ``stage``, then publish it into ``corpus``
    when one is given, and with ``public`` write the active release's catalog and search index
    there (``write_public``); returns one report line per step. With no ``stage``, the stage is a
    temporary folder inside ``corpus`` that is deleted once published."""
    if stage is not None:
        return _export_and_publish(data_dir, stage, corpus, public)
    if corpus is None:
        raise ValueError("export_corpus needs a stage or a corpus folder")
    corpus.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix=".stage-", dir=corpus))
    try:
        return _export_and_publish(data_dir, temporary, corpus, public)
    finally:
        shutil.rmtree(temporary, ignore_errors=True)


def _export_and_publish(
    data_dir: Path, stage: Path, corpus: Path | None, public: Path | None
) -> list[str]:
    lines = _export(data_dir, stage)
    if corpus is None:
        return lines
    release = publish(stage, corpus)
    lines.append(f"release {release}")
    if public is not None:
        lines.append(write_public(stage, public, release))
    return lines


def _export(data_dir: Path, stage: Path) -> list[str]:
    """The catalog lists what the other areas wrote; the search index holds the texts of the laws
    and drafts. Collections and the catalog add no search records, so the index is written (by
    the ``pagefind`` subprocess, which a thread waits for) while they are exported. The report
    keeps one order: laws, collections, drafts, catalog, search."""
    stage.mkdir(parents=True, exist_ok=True)
    laws = Laws(data_dir)
    search = SearchRecords()
    laws_line = export_laws(laws, stage, search)
    drafts_line = export_drafts(data_dir, stage, search)
    with ThreadPoolExecutor(max_workers=1) as indexer:
        indexing = indexer.submit(search.write, stage)
        collections_line = export_collections(laws, stage)
        catalog_line = export_catalog(laws, data_dir, stage)
        search_line = indexing.result()
    return [laws_line, collections_line, drafts_line, catalog_line, search_line]
