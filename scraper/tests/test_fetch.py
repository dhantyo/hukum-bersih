import json

from hukum_bersih.fetch import (
    default_item_id,
    known_hashes,
    manifest_path,
    raw_wayback_url,
    safe_filename,
)

WAYBACK = (
    "https://web.archive.org/web/20251106052153/https://jdih.ppatk.go.id/storage/"
    "dokumen_produk_hukum/Draft%20Final%20RUU%20Perampasan%20Aset%20.pdf"
)
DPR = "https://berkas2.dpr.go.id/akd/dokumen/komisi3-RJ-20261119-043602-5251.pdf"


def test_raw_wayback_url():
    assert raw_wayback_url(WAYBACK).startswith("https://web.archive.org/web/20251106052153id_/https://jdih")
    assert raw_wayback_url(raw_wayback_url(WAYBACK)) == raw_wayback_url(WAYBACK)
    assert raw_wayback_url(DPR) == DPR


def test_safe_filename():
    assert safe_filename(WAYBACK) == "Draft-Final-RUU-Perampasan-Aset.pdf"
    assert safe_filename(DPR) == "komisi3-RJ-20261119-043602-5251.pdf"


def test_default_item_id():
    assert default_item_id(DPR) == "hukum-bersih-dpr-komisi3-rj-20261119-043602-5251"
    assert default_item_id(WAYBACK) == "hukum-bersih-ppatk-draft-final-ruu-perampasan-aset"


def test_manifest_path_uses_original_host(tmp_path):
    assert manifest_path(tmp_path, WAYBACK).name == "jdih.ppatk.go.id.jsonl"
    assert manifest_path(tmp_path, DPR).name == "berkas2.dpr.go.id.jsonl"


def test_known_hashes(tmp_path):
    m = tmp_path / "m.jsonl"
    m.write_text(
        json.dumps({"source_url": DPR, "sha256": "a"}) + "\n"
        + json.dumps({"source_url": "other", "sha256": "b"}) + "\n"
    )
    assert known_hashes(m, DPR) == {"a"}
    assert known_hashes(tmp_path / "missing.jsonl", DPR) == set()
