"""``hukum-bersih export-corpus``: every area of the web corpus, in order, into a stage, and with
``--publish`` the stage stored as a release in a corpus folder."""

from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

from .catalog import export_catalog
from .collection_export import export_collections
from .drafts import export_drafts
from .laws import Laws, export_laws
from .release import publish
from .search import SearchRecords


def export_corpus(data_dir: Path, stage: Path | None, corpus: Path | None = None) -> list[str]:
    """Write the corpus built from ``data_dir`` into ``stage``, then publish it into ``corpus``
    when one is given; returns one report line per step. With no ``stage``, the stage is a
    temporary folder inside ``corpus`` that is deleted once published."""
    if stage is not None:
        return _export_and_publish(data_dir, stage, corpus)
    if corpus is None:
        raise ValueError("export_corpus needs a stage or a corpus folder")
    corpus.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix=".stage-", dir=corpus))
    try:
        return _export_and_publish(data_dir, temporary, corpus)
    finally:
        shutil.rmtree(temporary, ignore_errors=True)


def _export_and_publish(data_dir: Path, stage: Path, corpus: Path | None) -> list[str]:
    lines = _export(data_dir, stage)
    return lines if corpus is None else [*lines, f"release {publish(stage, corpus)}"]


def _export(data_dir: Path, stage: Path) -> list[str]:
    """The catalog lists what the other areas wrote; the search index, last, holds their texts."""
    stage.mkdir(parents=True, exist_ok=True)
    laws = Laws(data_dir)
    search = SearchRecords()
    lines = [export_laws(laws, stage, search), export_collections(laws, stage),
             export_drafts(data_dir, stage, search), export_catalog(laws, data_dir, stage)]
    return [*lines, search.write(stage)]
