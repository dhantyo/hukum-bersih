"""archive.org (Internet Archive): upload source files, rewrite titles, empty obsolete items.

PDFs never enter git (docs/BRIEF.md §5.3); they live on archive.org, named by id
(docs/NAMING.md). Credentials come from IA_ACCESS_KEY / IA_SECRET_KEY (GitHub secrets).
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
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


@dataclass(frozen=True)
class Repaired:
    """The file archived is a structural rewrite of the downloaded one (same pages, same text)."""
    sha256: str
    note: str


def upload(path: Path, doc_id: str, filename: str, source_url: str, original_filename: str,
           data_dir: Path, title: str | None = None, attempts: int = 3) -> Repaired | None:
    """Upload, retrying timeouts and server errors. archive.org refuses some PDFs whose file
    structure is damaged ("Uploaded content is unacceptable - Syntax error detected in pdf
    data"; BPK's copies of e.g. UU 30/1947 have broken linearization hints). Such a PDF is
    rewritten with qpdf, checked to have the same pages and text, and that copy is archived;
    the caller records both hashes. Returns what was repaired, or None."""
    import time

    repaired: Repaired | None = None
    for attempt in range(attempts):
        try:
            _upload_once(path, doc_id, filename, source_url, original_filename, data_dir, title)
            return repaired
        except Exception as e:
            msg = str(e).lower()
            if "unacceptable" in msg and repaired is None and path.suffix.lower() == ".pdf":
                fixed = path.with_name(path.stem + ".repaired.pdf")
                repaired = repair_pdf(path, fixed)
                path = fixed
                continue
            transient = re.search(r"\b(50[0-4]|429|timed out|timeout|connection (?:reset|aborted|"
                                  r"refused|error)|remote end closed|slow down)\b", msg)
            if not transient or attempt == attempts - 1:
                raise
            time.sleep(30 * (attempt + 1))
    return repaired


def repair_pdf(src: Path, dest: Path) -> Repaired:
    """Rewrite a PDF's file structure with qpdf (pikepdf), without linearization. Raises unless
    the copy has the same number of pages and the same text on every page."""
    import pikepdf
    import pymupdf

    from .manifest import sha256_file

    with pikepdf.open(src) as pdf:
        pdf.save(dest, linearize=False)
    with pymupdf.open(src) as a, pymupdf.open(dest) as b:
        if len(a) != len(b) or any(pa.get_text() != pb.get_text() for pa, pb in zip(a, b, strict=True)):
            raise RuntimeError(f"{src.name}: rewritten PDF differs in pages or text; not archived")
        pages = len(a)
    return Repaired(sha256_file(dest), f"file structure rewritten by qpdf for archive.org "
                                       f"(same {pages} pages and text)")


def _upload_once(path: Path, doc_id: str, filename: str, source_url: str, original_filename: str,
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
