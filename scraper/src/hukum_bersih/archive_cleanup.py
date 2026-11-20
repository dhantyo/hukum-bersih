"""Remove the files of obsolete archive.org items we uploaded (e.g. after a rename).

archive.org does not let uploaders delete an item itself, only its files. The emptied item is
retitled and marked noindex so it drops out of search.
"""

from __future__ import annotations

import os

SYSTEM_SUFFIXES = ("_meta.xml", "_files.xml", "_meta.sqlite", "_reviews.xml")


def empty_item(identifier: str) -> list[str]:
    import internetarchive

    access, secret = os.environ.get("IA_ACCESS_KEY"), os.environ.get("IA_SECRET_KEY")
    if not (access and secret):
        raise RuntimeError("IA_ACCESS_KEY and IA_SECRET_KEY must be set")
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
        responses = internetarchive.delete(
            identifier, files=originals, cascade_delete=True, access_key=access, secret_key=secret,
        )
        for r in responses:
            if getattr(r, "status_code", 200) >= 400:
                raise RuntimeError(f"{identifier}: delete failed ({r.status_code}): {r.text[:300]}")
    r = item.modify_metadata(
        {"title": "Duplikat (berkas dihapus)", "noindex": "true",
         "description": "Item ini duplikat dan berkasnya telah dihapus."}
    )
    if getattr(r, "status_code", 200) >= 400:
        raise RuntimeError(f"{identifier}: metadata update failed ({r.status_code}): {r.text[:300]}")
    return originals
