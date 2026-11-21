"""archive.upload: retries transient failures, repairs PDFs archive.org refuses (no network)."""

import pytest

from hukum_bersih import archive


def small_pdf(path):
    import pymupdf

    doc = pymupdf.open()
    doc.new_page().insert_text((72, 72), "UNDANG-UNDANG REPUBLIK INDONESIA")
    doc.save(path)
    return path


def fake(monkeypatch, errors):
    calls = []

    def once(path, *a, **k):
        calls.append(path.name)
        if errors:
            raise RuntimeError(errors.pop(0))

    monkeypatch.setattr(archive, "_upload_once", once)
    monkeypatch.setattr("time.sleep", lambda s: None)
    return calls


def test_refused_pdf_is_repaired_and_uploaded(tmp_path, monkeypatch):
    calls = fake(monkeypatch, ["error uploading x.pdf, Uploaded content is unacceptable. - Syntax error detected in pdf data."])
    r = archive.upload(small_pdf(tmp_path / "x.pdf"), "uu_1_2000_2000-01-01", "x.pdf", "u", "x.pdf", tmp_path)
    assert calls == ["x.pdf", "x.repaired.pdf"]
    assert r and len(r.sha256) == 64 and "same 1 pages" in r.note


def test_timeouts_are_retried(tmp_path, monkeypatch):
    calls = fake(monkeypatch, ["Read timed out. (read timeout=120)"])
    assert archive.upload(small_pdf(tmp_path / "x.pdf"), "uu_1_2000_2000-01-01", "x.pdf", "u", "x.pdf", tmp_path) is None
    assert calls == ["x.pdf", "x.pdf"]


def test_other_errors_are_not_retried(tmp_path, monkeypatch):
    calls = fake(monkeypatch, ["403 Forbidden: bad keys"])
    with pytest.raises(RuntimeError, match="403"):
        archive.upload(small_pdf(tmp_path / "x.pdf"), "uu_1_2000_2000-01-01", "x.pdf", "u", "x.pdf", tmp_path)
    assert calls == ["x.pdf"]


def test_manifest_line_only_carries_repair_fields_when_repaired():
    from hukum_bersih.manifest import ManifestEntry

    e = ManifestEntry("u", "t", "a" * 64, 1)
    assert "archived_sha256" not in e.to_dict() and "note" not in e.to_dict()
    assert ManifestEntry("u", "t", "a" * 64, 1, archived_sha256="b" * 64, note="n").to_dict()["note"] == "n"
