"""The files of ``drafts/`` as ``hukum-bersih export-corpus`` writes them
(hukum_bersih.corpus.drafts)."""

import json

from hukum_bersih.corpus.drafts import export_drafts
from hukum_bersih.corpus.search import SearchRecords

OLD_TEXT = """BODY
  CHAPTER I - KETENTUAN UMUM

    ART 1 -
      Setiap orang yang menguasai aset hasil tindak pidana wajib melaporkan kepada penyidik.

    ART 2 -
      Pelaku dipidana dengan pidana penjara paling lama sepuluh tahun.
"""
NEW_TEXT = """BODY
  CHAPTER I - KETENTUAN UMUM

    ART 1 -
      Setiap orang yang menguasai aset hasil tindak pidana wajib melaporkan kepada penegak hukum.

    ART 2 -
      Pelaku dipidana dengan pidana penjara paling lama lima belas tahun.
"""
RECORD = """id: ruu/contoh
title: RUU tentang Contoh
short_name: RUU Contoh
stages:
  - { stage: surat_presiden, date: 2026-05-04 }
enacted_as: null
documents:
  - id: ruu_contoh_2026-05_draft
    type: draft
    date: 2026-05
    provenance: official
    source_url: https://example.test/lama.pdf
    sha256: 0000
    text: versions/lama.txt
  - id: ruu_contoh_2026-11-19_draft-final
    type: draft-final
    label: Draf final
    date: 2026-11-19
    provenance: null
    source_url: null
    text: versions/baru.txt
  - { id: ruu_contoh_2008_draft, type: draft, date: 2008, provenance: null, source_url: null }
"""


def _data(tmp_path):
    folder = tmp_path / "data" / "ruu" / "contoh"
    (folder / "versions").mkdir(parents=True)
    (folder / "ruu.yaml").write_text(RECORD, encoding="utf-8")
    (folder / "versions" / "lama.txt").write_text(OLD_TEXT, encoding="utf-8")
    (folder / "versions" / "baru.txt").write_text(NEW_TEXT, encoding="utf-8")
    return tmp_path / "data"


def test_a_bill_gets_a_record_a_text_per_version_and_one_comparison(tmp_path):
    stage = tmp_path / "stage"

    assert export_drafts(_data(tmp_path), stage, SearchRecords()) == "Exported 1 drafts"

    names = sorted(p.relative_to(stage).as_posix() for p in stage.rglob("*.json"))
    assert names == [
        "drafts/contoh/comparisons/ruu_contoh_2026-05_draft...ruu_contoh_2026-11-19_draft-final.json",
        "drafts/contoh/documents/ruu_contoh_2026-05_draft.json",
        "drafts/contoh/documents/ruu_contoh_2026-11-19_draft-final.json",
        "drafts/contoh/index.json",
    ]


def test_the_record_lists_every_document_with_dates_as_written(tmp_path):
    stage = tmp_path / "stage"
    export_drafts(_data(tmp_path), stage, SearchRecords())

    raw = (stage / "drafts" / "contoh" / "index.json").read_bytes()
    record = json.loads(raw)

    assert not raw.endswith(b"\n")                      # JavaScript wrote no final newline
    assert record["name"] == "RUU Contoh"
    assert record["stages"] == [{"stage": "surat_presiden", "date": "2026-05-04"}]
    assert [(d["id"], d["date"], d["hasText"]) for d in record["documents"]] == [
        ("ruu_contoh_2026-05_draft", "2026-05", True),
        ("ruu_contoh_2026-11-19_draft-final", "2026-11-19", True),
        ("ruu_contoh_2008_draft", "2008", False),
    ]
    assert "sha256" not in record["documents"][0]
    assert record["documents"][1]["provenance"] is None


def test_the_comparison_pairs_the_two_versions_and_marks_the_changed_words(tmp_path):
    stage = tmp_path / "stage"
    export_drafts(_data(tmp_path), stage, SearchRecords())

    pair = "ruu_contoh_2026-05_draft...ruu_contoh_2026-11-19_draft-final.json"
    comparison = json.loads((stage / "drafts" / "contoh" / "comparisons" / pair).read_text())

    assert comparison["older"]["id"] == "ruu_contoh_2026-05_draft"
    assert comparison["newer"]["label"] == "Draf final"
    assert comparison["counts"] == {"sama": 0, "berubah": 2, "baru": 0, "dihapus": 0,
                                    "renumbered": 0, "moved": 0}
    [first, second] = comparison["rows"]
    assert first["chapter"] == "BAB I"
    assert "chapter" not in second
    removed = [p["value"] for p in first["lines"][0]["parts"] if p["removed"]]
    added = [p["value"] for p in first["lines"][0]["parts"] if p["added"]]
    assert removed == ["penyidik"]
    assert added == ["penegak hukum"]


def test_a_document_lists_the_other_versions_with_the_comparison_that_holds_each(tmp_path):
    stage = tmp_path / "stage"
    export_drafts(_data(tmp_path), stage, SearchRecords())
    pair = "ruu_contoh_2026-05_draft...ruu_contoh_2026-11-19_draft-final"

    def comparable(name):
        path = stage / "drafts" / "contoh" / "documents" / f"{name}.json"
        return json.loads(path.read_text())["comparable"]

    assert comparable("ruu_contoh_2026-05_draft") == [
        {"id": "ruu_contoh_2026-11-19_draft-final", "type": "draft-final", "date": "2026-11-19",
         "pair": pair}]
    assert comparable("ruu_contoh_2026-11-19_draft-final") == [
        {"id": "ruu_contoh_2026-05_draft", "type": "draft", "date": "2026-05", "pair": pair}]
    assert (stage / "drafts" / "contoh" / "comparisons" / f"{pair}.json").exists()
