"""Download a source document, archive it on the Internet Archive, record it in a manifest.

PDFs never enter git (BRIEF §5.3). Each file gets a readable doc id (docs/NAMING.md),
becomes the Internet Archive item ``hukum-bersih-<doc id>`` holding ``<doc id>.<ext>``, and one
line in ``data/sources/manifests/<host>.jsonl``. A file already archived under the same doc id
with the same sha256 is skipped, so runs are idempotent.
"""

from __future__ import annotations

import json
import os
import re
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import unquote, urlparse

import httpx

from . import USER_AGENT
from .manifest import ManifestEntry, entry_for_file

ITEM_PREFIX = "hukum-bersih"
DOC_ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
WAYBACK_RE = re.compile(r"^https?://web\.archive\.org/web/(\d+)(?:id_)?/(.+)$")


@dataclass(frozen=True)
class FetchResult:
    entry: ManifestEntry
    item: str
    filename: str
    skipped: bool
    manifest: Path


def raw_wayback_url(url: str) -> str:
    """Wayback URLs serve an HTML wrapper unless the timestamp carries the ``id_`` flag."""
    m = WAYBACK_RE.match(url)
    return f"https://web.archive.org/web/{m.group(1)}id_/{m.group(2)}" if m else url


def safe_filename(url: str) -> str:
    p = Path(unquote(urlparse(url).path))
    stem = re.sub(r"[^A-Za-z0-9._-]+", "-", p.stem).strip("-.") or "document"
    suffix = re.sub(r"[^A-Za-z0-9.]+", "", p.suffix)
    return stem + suffix


def validate_doc_id(doc_id: str) -> str:
    if not DOC_ID_RE.match(doc_id):
        raise ValueError(
            f"invalid doc id {doc_id!r}: use lowercase letters, digits and single hyphens "
            "(see docs/NAMING.md)"
        )
    if len(ITEM_PREFIX) + 1 + len(doc_id) > 100:  # IA identifier limit
        raise ValueError(f"doc id too long: {doc_id!r}")
    return doc_id


def item_id(doc_id: str) -> str:
    return f"{ITEM_PREFIX}-{validate_doc_id(doc_id)}"


def archived_filename(doc_id: str, url: str) -> str:
    ext = Path(safe_filename(url)).suffix.lower() or ".pdf"
    return f"{validate_doc_id(doc_id)}{ext}"


def manifest_path(data_dir: Path, url: str) -> Path:
    m = WAYBACK_RE.match(url)
    host = urlparse(m.group(2) if m else url).hostname or "unknown"
    return data_dir / "sources" / "manifests" / f"{host}.jsonl"


def already_archived(manifest: Path, url: str, sha256: str, archive_url: str | None) -> bool:
    if not manifest.exists():
        return False
    for line in manifest.read_text().splitlines():
        if line.strip():
            rec = json.loads(line)
            if (rec.get("source_url"), rec.get("sha256"), rec.get("archive_url")) == (
                url, sha256, archive_url,
            ):
                return True
    return False


def download(url: str, dest: Path, retries: int = 3) -> None:
    last: Exception | None = None
    for attempt in range(retries):
        try:
            with httpx.stream(
                "GET", url, headers={"User-Agent": USER_AGENT}, follow_redirects=True,
                timeout=httpx.Timeout(60, read=300),
            ) as r:
                r.raise_for_status()
                with dest.open("wb") as f:
                    for chunk in r.iter_bytes(1 << 20):
                        f.write(chunk)
            return
        except httpx.HTTPError as e:
            last = e
            time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"download failed after {retries} attempts: {url}: {last}")


def upload_to_ia(
    path: Path, item: str, filename: str, source_url: str, title: str, original_filename: str,
) -> None:
    import internetarchive

    access, secret = os.environ.get("IA_ACCESS_KEY"), os.environ.get("IA_SECRET_KEY")
    if not (access and secret):
        raise RuntimeError("IA_ACCESS_KEY and IA_SECRET_KEY must be set to archive files")
    metadata = {
        "mediatype": "texts",
        "collection": "opensource",
        "title": title,
        "source": source_url,
        "original_filename": original_filename,
        "language": "ind",
        "subject": ["Indonesian law", "hukum-bersih"],
        "description": f"Archived by hukum-bersih (https://github.com/dhantyo/hukum-bersih) "
        f"from {source_url} (original file name: {original_filename})",
    }
    responses = internetarchive.upload(
        item, files={filename: str(path)}, metadata=metadata, access_key=access,
        secret_key=secret, checksum=True, retries=5, retries_sleep=10, validate_identifier=True,
    )
    for r in responses:
        if hasattr(r, "status_code") and r.status_code >= 400:
            raise RuntimeError(f"IA upload failed ({r.status_code}): {r.text[:300]}")


def fetch_and_archive(
    url: str, doc_id: str, data_dir: Path, title: str | None = None, archive: bool = True,
) -> FetchResult:
    item = item_id(doc_id)
    filename = archived_filename(doc_id, url)
    manifest = manifest_path(data_dir, url)
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / filename
        download(raw_wayback_url(url), path)
        archive_url = f"https://archive.org/download/{item}/{filename}" if archive else None
        entry = entry_for_file(path, url, archive_url, doc_id, safe_filename(url))
        if already_archived(manifest, url, entry.sha256, archive_url):
            return FetchResult(entry, item, filename, True, manifest)
        if not path.read_bytes()[:5].startswith(b"%PDF"):
            print(f"warning: {url} does not look like a PDF")
        if archive:
            upload_to_ia(path, item, filename, url, title or doc_id, entry.original_filename)
    manifest.parent.mkdir(parents=True, exist_ok=True)
    with manifest.open("a") as f:
        f.write(json.dumps(entry.to_dict(), ensure_ascii=False) + "\n")
    return FetchResult(entry, item, filename, False, manifest)
