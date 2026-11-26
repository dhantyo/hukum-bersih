"""``hukum-bersih release publish|activate``: turn a stage written by ``export-corpus`` into a
release the website reads, and say which release is live.

The layout under a corpus folder (``HUKUM_CORPUS_DIR`` for ``web``, the bucket root in R2):

    active-release                 the id of the live release, one line
    releases/<id>/...              the stage's files, plus ``release-id``
    releases/<id>/release-id       the ready marker: written first inside the folder, so a folder
                                   without it was cut short and is never activated

The id is the SHA-256 of one line per file, ``["<path>","<sha256 of the file>"]`` and a newline,
the paths sorted by UTF-16 code unit (as ``Array.prototype.toSorted`` does). The same files give
the same id and so the same release folder: publishing twice does nothing the second time.

The pointer moves last, by a rename, so a reader sees the old release or the new one, never a
half-copied one. CI uploads ``releases/<id>`` to R2 with rclone, the marker after the other files,
and then the pointer, in that order.
"""

from __future__ import annotations

import errno
import hashlib
import json
import os
import re
import shutil
import tempfile
from pathlib import Path

from .write import dumps

READY_FILE = "release-id"
ACTIVE_FILE = "active-release"
RELEASE_ID = re.compile(r"[a-f0-9]{64}")

# The parts of a stage that make a release. A stage may hold other files; they are left out.
REQUIRED_PARTS = ("laws", "pagefind", "law-catalog.json", "listings")
OPTIONAL_PARTS = ("collections", "drafts")


class ReleaseError(Exception):
    """The stage is not a complete corpus, or the release asked for is not ready."""


def publish(stage: Path, corpus: Path) -> str:
    """Store the stage in ``corpus`` as a release and make it the active one; returns its id.
    The stage is not changed. A release that is already stored is checked and kept, not replaced."""
    corpus.mkdir(parents=True, exist_ok=True)
    # The scratch folder sits in the corpus folder so the final rename stays on one file system.
    scratch = Path(tempfile.mkdtemp(prefix=".corpus-release-", dir=corpus))
    try:
        release = _store(stage, corpus, scratch)
    finally:
        shutil.rmtree(scratch, ignore_errors=True)
    activate(release, corpus)
    return release


def activate(release: str, corpus: Path) -> None:
    """Make an already stored release the active one (to go back to an earlier release)."""
    _assert_ready(release, corpus)
    handle, name = tempfile.mkstemp(prefix=".active-release-", dir=corpus, text=True)
    with os.fdopen(handle, "w", encoding="utf-8") as pointer:
        pointer.write(f"{release}\n")
    os.chmod(name, 0o644)
    os.replace(name, corpus / ACTIVE_FILE)


def release_digest(directory: Path) -> str:
    """The release id of the files under ``directory`` (see the module text)."""
    files = [path for path in directory.rglob("*") if not path.is_dir() or path.is_symlink()]
    if not all(path.is_file() and not path.is_symlink() for path in files):
        raise ReleaseError("Release contents must be regular files")
    keys = sorted((path.relative_to(directory).as_posix() for path in files), key=_utf16_order)
    digest = hashlib.sha256()
    for key in keys:
        with (directory / key).open("rb") as handle:
            checksum = hashlib.file_digest(handle, "sha256").hexdigest()
        digest.update(dumps([key, checksum]).encode())
    return digest.hexdigest()


def _utf16_order(key: str) -> bytes:
    return key.encode("utf-16-be", "surrogatepass")


def _store(stage: Path, corpus: Path, scratch: Path) -> str:
    directory = scratch / "release"
    directory.mkdir()
    for part in REQUIRED_PARTS:
        if not (stage / part).exists():
            raise ReleaseError(f"The stage has no {part}")
    for part in (*REQUIRED_PARTS, *OPTIONAL_PARTS):
        source = stage / part
        if source.is_dir():
            shutil.copytree(source, directory / part, symlinks=True)
        elif source.exists():
            shutil.copy2(source, directory / part, follow_symlinks=False)
    _validate(directory)
    release = release_digest(directory)
    (directory / READY_FILE).write_text(f"{release}\n", encoding="utf-8")
    target = corpus / "releases" / release
    target.parent.mkdir(exist_ok=True)
    try:
        directory.rename(target)
    except OSError as error:
        if error.errno not in (errno.EEXIST, errno.ENOTEMPTY):
            raise
        _assert_ready(release, corpus)           # stored by an earlier publish
    return release


def _validate(directory: Path) -> None:
    if not any(directory.glob("laws/uu/*/*/index.json")):
        raise ReleaseError("The release contains no law documents")
    entry_file = directory / "pagefind" / "pagefind-entry.json"
    if not entry_file.is_file() or not (directory / "pagefind" / "pagefind.js").is_file():
        raise ReleaseError("The release has no Pagefind index")
    entry = json.loads(entry_file.read_text("utf-8"))
    languages = (entry.get("languages") or {}).values()
    if not any(language["page_count"] > 0 for language in languages):
        raise ReleaseError("The release has no searchable Pagefind documents")


def _assert_ready(release: str, corpus: Path) -> None:
    if not RELEASE_ID.fullmatch(release):
        raise ReleaseError(f"Invalid release ID: {release}")
    marker = corpus / "releases" / release / READY_FILE
    try:
        text = marker.read_text("utf-8")
    except FileNotFoundError:
        raise ReleaseError(f"Release {release} is incomplete or not published here") from None
    if text.strip() != release:
        raise ReleaseError(f"Release {release} is incomplete")
