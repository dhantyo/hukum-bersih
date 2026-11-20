"""archive.org (Internet Archive): upload source files, rewrite titles, empty obsolete items.

PDFs never enter git (docs/BRIEF.md §5.3); they live on archive.org, named by id
(docs/NAMING.md). Credentials come from IA_ACCESS_KEY / IA_SECRET_KEY (GitHub secrets).
"""

from __future__ import annotations

import os
from pathlib import Path

from .manifest import latest_entry
from .naming import archive_item, default_title, full_title

SYSTEM_SUFFIXES = ("_meta.xml", "_files.xml", "_meta.sqlite", "_reviews.xml")


def _keys() -> tuple[str, str]:
    access, secret = os.environ.get("IA_ACCESS_KEY"), os.environ.get("IA_SECRET_KEY")
    if not (access and secret):
        raise RuntimeError("IA_ACCESS_KEY and IA_SECRET_KEY must be set")
    return access, secret


def _check(r, what: str) -> None:
    if getattr(r, "status_code", 200) >= 400:
        raise RuntimeError(f"{what} failed ({r.status_code}): {r.text[:300]}")


def description(full: str, source_url: str, original_filename: str) -> str:
    return (
        f"{full}. Salinan arsip dari {source_url} (nama berkas asli: {original_filename}). "
        "Diarsipkan oleh proyek terbuka hukum-bersih (https://github.com/dhantyo/hukum-bersih) "
        "agar dokumen hukum publik tetap dapat diakses. / Archived copy of a public Indonesian "
        "legal document."
    )


def upload(path: Path, doc_id: str, filename: str, source_url: str, original_filename: str,
           data_dir: Path, title: str | None = None) -> None:
    import internetarchive

    access, secret = _keys()
    metadata = {
        "mediatype": "texts",
        "collection": "opensource",
        "title": title or default_title(doc_id, data_dir),
        "source": source_url,
        "original_filename": original_filename,
        "language": "ind",
        "subject": ["hukum Indonesia", "peraturan perundang-undangan", "Indonesian law"],
        "description": description(full_title(doc_id, data_dir), source_url, original_filename),
    }
    for r in internetarchive.upload(
        archive_item(doc_id), files={filename: str(path)}, metadata=metadata, access_key=access,
        secret_key=secret, checksum=True, retries=5, retries_sleep=10, validate_identifier=True,
    ):
        _check(r, "upload")


def retitle(doc_id: str, data_dir: Path, title: str | None = None) -> dict:
    """Rewrite title and description of an archived item. Never touches its files."""
    import internetarchive

    access, secret = _keys()
    rec = latest_entry(data_dir, doc_id)
    if rec is None:
        raise RuntimeError(f"{doc_id}: not in any source manifest")
    metadata = {
        "title": title or default_title(doc_id, data_dir),
        "description": description(
            full_title(doc_id, data_dir), rec["source_url"], rec.get("original_filename", "")
        ),
    }
    r = internetarchive.modify_metadata(
        archive_item(doc_id), metadata, access_key=access, secret_key=secret
    )
    _check(r, f"{doc_id}: metadata update")
    return metadata


def empty_item(identifier: str) -> list[str]:
    """Delete the files of an obsolete item we uploaded and retitle it. archive.org does not
    let uploaders delete an item itself or hide it from search (noindex is read-only)."""
    import internetarchive

    access, secret = _keys()
    session = internetarchive.get_session(config={"s3": {"access": access, "secret": secret}})
    item = session.get_item(identifier)
    if not item.exists:
        raise RuntimeError(f"{identifier}: no such item")
    originals = [
        f["name"] for f in item.files
        if f.get("source") == "original" and not f["name"].endswith(SYSTEM_SUFFIXES)
        and not f["name"].startswith("__ia_thumb")
    ]
    if originals:
        for r in internetarchive.delete(
            identifier, files=originals, cascade_delete=True, access_key=access, secret_key=secret,
        ):
            _check(r, f"{identifier}: delete")
    r = item.modify_metadata({"title": "Duplikat (berkas dihapus)",
                              "description": "Item ini duplikat dan berkasnya telah dihapus."})
    _check(r, f"{identifier}: metadata update")
    return originals
