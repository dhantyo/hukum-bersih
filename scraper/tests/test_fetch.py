import json

import pytest

from hukum_bersih.cli import main
from hukum_bersih.fetch import (
    already_archived,
    archived_filename,
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


def test_archived_filename():
    assert archived_filename("uu_11_2008_2008-04-21", "https://h/a/FILE.PDF") == (
        "uu_11_2008_2008-04-21.pdf"
    )


def test_cli_requires_pairs(capsys):
    with pytest.raises(SystemExit):
        main(["fetch", DPR])
    with pytest.raises(SystemExit):
        main(["fetch", DPR, "uu_8_2010"])
    with pytest.raises(SystemExit):
        main(["fetch", "Bad_Name", DPR])


def test_manifest_path_uses_original_host(tmp_path):
    assert manifest_path(tmp_path, WAYBACK).name == "jdih.ppatk.go.id.jsonl"
    assert manifest_path(tmp_path, DPR).name == "berkas2.dpr.go.id.jsonl"


def test_already_archived(tmp_path):
    m = tmp_path / "m.jsonl"
    m.write_text(json.dumps({"source_url": DPR, "sha256": "a", "archive_url": "old"}) + "\n")
    assert already_archived(m, DPR, "a", "old")
    assert not already_archived(m, DPR, "a", "new")  # renamed: archive again under the new id
    assert not already_archived(m, DPR, "b", "old")  # file changed upstream
    assert not already_archived(tmp_path / "missing.jsonl", DPR, "a", "old")
