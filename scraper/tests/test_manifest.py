import hashlib

from hukum_bersih.manifest import entry_for_file, is_unchanged


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
