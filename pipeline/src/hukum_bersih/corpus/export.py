"""``hukum-bersih export-corpus <dir>``: every area of the web corpus, in order, into a stage."""

from __future__ import annotations

from pathlib import Path

from .catalog import export_catalog
from .collection_export import export_collections
from .drafts import export_drafts
from .laws import Laws, export_laws


def export_corpus(data_dir: Path, stage: Path) -> list[str]:
    """Write the corpus built from ``data_dir`` into ``stage``; returns one report line per area.
    The catalog is last: it lists what the other areas wrote."""
    stage.mkdir(parents=True, exist_ok=True)
    laws = Laws(data_dir)
    return [export_laws(laws, stage), export_collections(laws, stage),
            export_drafts(data_dir, stage), export_catalog(laws, data_dir, stage)]
