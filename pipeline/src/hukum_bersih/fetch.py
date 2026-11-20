"""Fetch a source document, archive it on archive.org, record it in the source manifest.

Each file gets an id (docs/NAMING.md) and is stored as ``<id>.<ext>`` in the archive.org item
for that document (for a regulation version, the item of the regulation), plus one line in
``data/sources/manifests/<host>.jsonl``. A file already archived under the same id with the
same sha256 is skipped, so runs are idempotent.
"""

from __future__ import annotations

import json
import tempfile
from dataclasses import dataclass
from pathlib import Path

from . import archive
from .manifest import ManifestEntry, already_archived, entry_for_file, manifest_path
from .naming import archive_item, validate_id
from .sources import wayback
from .sources.http import download, safe_filename


@dataclass(frozen=True)
class FetchResult:
    entry: ManifestEntry
    item: str
    filename: str
    skipped: bool
    manifest: Path


def archived_filename(doc_id: str, url: str) -> str:
    ext = Path(safe_filename(url)).suffix.lower() or ".pdf"
    return f"{validate_id(doc_id)}{ext}"


def fetch_and_archive(
    url: str, doc_id: str, data_dir: Path, title: str | None = None, do_archive: bool = True,
) -> FetchResult:
    item = archive_item(doc_id)
    filename = archived_filename(doc_id, url)
    manifest = manifest_path(data_dir, url)
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / filename
        download(wayback.raw_url(url), path)
        archive_url = f"https://archive.org/download/{item}/{filename}" if do_archive else None
        entry = entry_for_file(path, url, archive_url, doc_id, safe_filename(url))
        if already_archived(manifest, url, entry.sha256, archive_url):
            return FetchResult(entry, item, filename, True, manifest)
        if not path.read_bytes()[:5].startswith(b"%PDF"):
            print(f"warning: {url} does not look like a PDF")
        if do_archive:
            archive.upload(path, doc_id, filename, url, entry.original_filename, data_dir, title)
    manifest.parent.mkdir(parents=True, exist_ok=True)
    with manifest.open("a") as f:
        f.write(json.dumps(entry.to_dict(), ensure_ascii=False) + "\n")
    return FetchResult(entry, item, filename, False, manifest)


@dataclass(frozen=True)
class Pending:
    version: str          # id of the text version the PDF belongs to, e.g. uu_3_2026_2026-05-20
    url: str
    title: str | None


def pending(data_dir: Path) -> list[Pending]:
    """Regulation PDFs the importer recorded but that are not on archive.org yet."""
    import yaml

    from .manifest import records

    archived = set()
    for r in records(data_dir):
        if r.get("archive_url") and r.get("doc_id"):
            try:
                archived.add(archive_item(r["doc_id"]))
            except ValueError:
                pass  # lines from before the naming rule (docs/NAMING.md) are history only
    out = []
    for path in sorted((data_dir / "peraturan").glob("*/*/*/*.yaml")):
        rec = yaml.safe_load(path.read_text())
        if rec["id"] in archived or not rec.get("source_pdf_url"):
            continue
        versions = rec.get("versions") or []
        version = (versions[0]["id"] if versions
                   else f"{rec['id']}_{rec.get('tanggal_penetapan') or rec['year']}")
        out.append(Pending(version, rec["source_pdf_url"], rec.get("title")))
    return out
