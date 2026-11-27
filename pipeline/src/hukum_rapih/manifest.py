"""Source manifest records: one entry per fetched file (BRIEF §5.3)."""

from __future__ import annotations

import hashlib
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path


@dataclass(frozen=True)
class ManifestEntry:
    source_url: str
    fetched_at: str
    sha256: str
    bytes: int
    archive_url: str | None = None
    doc_id: str | None = None
    original_filename: str | None = None
    archived_sha256: str | None = None   # only when the archived copy differs (old lines, from a qpdf-rewritten upload)
    note: str | None = None

    def to_dict(self) -> dict:
        d = asdict(self)
        for k in ("archived_sha256", "note"):
            if d[k] is None:
                del d[k]
        return d


def sha256_file(path: Path, chunk_size: int = 1 << 20) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while chunk := f.read(chunk_size):
            h.update(chunk)
    return h.hexdigest()


def entry_for_file(
    path: Path, source_url: str, archive_url: str | None = None,
    doc_id: str | None = None, original_filename: str | None = None,
) -> ManifestEntry:
    return ManifestEntry(
        source_url=source_url,
        fetched_at=datetime.now(UTC).isoformat(timespec="seconds"),
        sha256=sha256_file(path),
        bytes=path.stat().st_size,
        archive_url=archive_url,
        doc_id=doc_id,
        original_filename=original_filename,
    )


def is_unchanged(path: Path, known_sha256: str | None) -> bool:
    """True if the file matches a previously recorded hash, so the run can skip it."""
    return known_sha256 is not None and sha256_file(path) == known_sha256


def manifest_path(data_dir: Path, source_url: str) -> Path:
    """One JSONL file per source host (the original host for Wayback copies)."""
    from urllib.parse import urlparse

    from .sources.wayback import original_url

    host = urlparse(original_url(source_url)).hostname or "unknown"
    return data_dir / "sources" / "manifests" / f"{host}.jsonl"


def records(data_dir: Path):
    import json

    for manifest in sorted((data_dir / "sources" / "manifests").glob("*.jsonl")):
        for line in manifest.read_text().splitlines():
            if line.strip():
                yield json.loads(line)
