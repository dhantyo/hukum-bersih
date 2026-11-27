import hashlib

from hukum_rapih.manifest import ManifestEntry, entry_for_file, is_unchanged


def test_entry_for_file(tmp_path):
    p = tmp_path / "doc.bin"
    p.write_bytes(b"pasal 5")
    entry = entry_for_file(p, "https://example.org/doc.pdf")
    assert entry.sha256 == hashlib.sha256(b"pasal 5").hexdigest()
    assert entry.bytes == 7
    assert entry.archive_url is None
    assert entry.fetched_at.endswith("+00:00")


def test_is_unchanged(tmp_path):
    p = tmp_path / "doc.bin"
    p.write_bytes(b"ayat 2")
    digest = hashlib.sha256(b"ayat 2").hexdigest()
    assert is_unchanged(p, digest)
    assert not is_unchanged(p, "0" * 64)
    assert not is_unchanged(p, None)


def test_manifest_line_only_carries_repair_fields_when_set():
    e = ManifestEntry("u", "t", "a" * 64, 1)
    assert "archived_sha256" not in e.to_dict() and "note" not in e.to_dict()
    assert ManifestEntry("u", "t", "a" * 64, 1, archived_sha256="b" * 64, note="n").to_dict()["note"] == "n"
