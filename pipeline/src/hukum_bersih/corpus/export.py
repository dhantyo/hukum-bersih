"""``hukum-bersih export-corpus <dir>``: every area of the web corpus, in order, into a stage."""

from __future__ import annotations

from pathlib import Path

from .laws import export_laws


def export_corpus(data_dir: Path, stage: Path) -> list[str]:
    """Write the corpus built from ``data_dir`` into ``stage``; returns one report line per area."""
    stage.mkdir(parents=True, exist_ok=True)
    return [export_laws(data_dir, stage)]
