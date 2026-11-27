"""``law-catalog.json`` and ``listings/`` as ``hukum-rapih export-corpus`` writes them
(hukum_rapih.corpus.catalog). The catalog lists what the stage holds, so each test marks the
laws and drafts it exports with an empty ``index.json``."""

import json
from pathlib import Path

import pytest
import yaml
from recfactory import make_record, make_version

from hukum_rapih.corpus.catalog import export_catalog, tanggal
from hukum_rapih.corpus.laws import Laws

BPK = "https://peraturan.bpk.go.id/Details/1"
GO_ID = "https://peraturan.go.id/id/uu-no-3-tahun-2020"
DRAFT = """id: ruu/contoh
title: RUU tentang Contoh
short_name: RUU Contoh
stages:
  - { stage: surat_presiden, date: 2026-05-04 }
  - { stage: pembicaraan_tingkat_i, date: 2026-11, note: Rapat kerja }
enacted_as: null
documents:
  - { id: ruu_contoh_2026-05_draft, type: draft, date: 2026-05, text: lama.txt }
  - { id: ruu_contoh_2026-11-19_draft-final, type: draft-final, date: 2026-11-19, text: baru.txt }
  - { id: ruu_contoh_2008_draft, type: draft, date: 2008 }
"""


def _law(root: Path, law_id: str, with_text: bool = True, **over) -> None:
    year = law_id.split("_")[2]
    folder = root / "peraturan" / "uu" / year / law_id
    folder.mkdir(parents=True)
    versions = [make_version(law_id, f"{year}-01-01")] if with_text else []
    relationships = {"amends": [], "amended_by": [], "revokes": [], "revoked_by": [],
                     **over.pop("relationships", {})}
    record = make_record(law_id, versions=versions, relationships=relationships, **over)
    (folder / f"{law_id}.yaml").write_text(yaml.safe_dump(record, allow_unicode=True))


def _release(tmp_path: Path, listed: tuple[str, ...] = ("uu/1/1950", "uu/3/2020", "uu/4/2009")
             ) -> tuple[Path, Path]:
    """A corpus of a repealed law, a named law with one amendment, and a draft."""
    data = tmp_path / "data"
    _law(data, "uu_1_1950", with_text=False, tentang="PERATURAN LAMA", status="Tidak Berlaku "
         "Dicabut Oleh : Undang-Undang Nomor 4 Tahun 2009", tanggal_penetapan="1950-05-17",
         source_url=BPK, relationships={"revoked_by": ["uu_4_2009"]})
    _law(data, "uu_4_2009", tentang="PERTAMBANGAN MINERAL DAN BATUBARA", status="diubah",
         tanggal_penetapan="2009-01-12", source_url=BPK,
         relationships={"revokes": ["uu_1_1950"], "amended_by": ["uu_3_2020"]})
    _law(data, "uu_3_2020", tentang="PERUBAHAN ATAS UNDANG-UNDANG NOMOR 4 TAHUN 2009",
         status="berlaku", tanggal_penetapan="2020-06-10", source_url=GO_ID,
         relationships={"amends": [{"id": "uu_4_2009", "order": 2}]})
    (data / "koleksi").mkdir()
    (data / "koleksi" / "minerba.yaml").write_text(yaml.safe_dump(
        {"slug": "uu-minerba", "name": "UU Minerba", "base": "uu_4_2009",
         "aliases": ["Minerba"]}))
    (data / "ruu" / "contoh").mkdir(parents=True)
    (data / "ruu" / "contoh" / "ruu.yaml").write_text(DRAFT, encoding="utf-8")

    stage = tmp_path / "stage"
    for path in listed:
        (stage / "laws" / path).mkdir(parents=True)
        (stage / "laws" / path / "index.json").write_text("{}")
    (stage / "drafts" / "contoh").mkdir(parents=True)
    (stage / "drafts" / "contoh" / "index.json").write_text("{}")
    export_catalog(Laws(data), data, stage)
    return data, stage


def _read(stage: Path, name: str):
    return json.loads((stage / name).read_text(encoding="utf-8"))


@pytest.fixture
def stage(tmp_path):
    return _release(tmp_path)[1]


def test_a_law_with_a_short_name_is_listed_with_what_it_amends_and_its_collection(stage):
    catalog = _read(stage, "law-catalog.json")
    laws = {entry["id"]: entry for entry in catalog["laws"]}

    assert laws["uu_4_2009"] == {
        "id": "uu_4_2009", "s": "UU Minerba", "c": "UU 4/2009",
        "t": "Pertambangan Mineral dan Batubara", "n": "4", "y": 2009, "st": "diubah",
        "m": [], "k": 2, "u": "/uu/4/2009/"}
    assert laws["uu_3_2020"]["s"] == "Perubahan Kedua UU Minerba"
    assert laws["uu_3_2020"]["m"] == ["uu_4_2009"]
    assert catalog["koleksi"] == [{
        "slug": "uu-minerba", "name": "UU Minerba", "named": True,
        "t": "Pertambangan Mineral dan Batubara", "a": ["Minerba"], "k": 2,
        "u": "/koleksi/uu-minerba/",
        "mem": [["uu_1_1950", "digantikan"], ["uu_4_2009", "pokok"],
                ["uu_3_2020", "perubahan kedua"]]}]


def test_a_draft_is_in_the_catalog_after_the_laws_newest_first(stage):
    entries = _read(stage, "law-catalog.json")["laws"]

    assert [e["id"] for e in entries] == ["uu_3_2020", "uu_4_2009", "uu_1_1950", "ruu_contoh"]
    assert entries[-1] == {"id": "ruu_contoh", "s": "RUU Contoh", "c": "RUU",
                           "t": "RUU tentang Contoh", "n": "", "y": 0, "st": "ruu", "m": [],
                           "k": 0, "u": "/ruu/contoh/"}


def test_a_repealed_law_shows_its_status_label_and_a_partial_date(stage):
    (row,) = _read(stage, "listings/years/1950.json")["rows"]

    assert row == {
        "u": "/uu/1/1950/", "title": "Peraturan Lama", "short": None, "cite": "UU 1/1950",
        "status": {"key": "dicabut", "label": "Dicabut"}, "date": "17 Mei 1950", "changed": 0,
        "amends": [], "hasText": False}


def test_a_year_page_lists_the_laws_of_that_year(tmp_path):
    _, stage = _release(tmp_path)

    assert _read(stage, "listings/years/2020.json") == {"year": 2020, "rows": [{
        "u": "/uu/3/2020/", "title": "Perubahan atas Undang-Undang Nomor 4 Tahun 2009",
        "short": "Perubahan Kedua UU Minerba", "cite": "UU 3/2020",
        "status": {"key": "berlaku", "label": "Berlaku"}, "date": "10 Juni 2020", "changed": 0,
        "amends": ["UU 4/2009"], "hasText": True}]}


def test_the_overview_counts_laws_by_source_and_decade(stage):
    overview = _read(stage, "listings/overview.json")

    assert (overview["total"], overview["withText"]) == (3, 2)
    assert overview["sources"] == [{"host": "peraturan.bpk.go.id", "name": "JDIH BPK"},
                                   {"host": "peraturan.go.id", "name": "peraturan.go.id"}]
    assert overview["decades"] == [
        {"decade": 2020, "years": [{"year": 2020, "count": 1}]},
        {"decade": 2000, "years": [{"year": 2009, "count": 1}]},
        {"decade": 1950, "years": [{"year": 1950, "count": 1}]}]
    assert [row["cite"] for row in overview["recent"]] == ["UU 3/2020", "UU 4/2009", "UU 1/1950"]


def test_the_drafts_listing_gives_the_last_stage_and_the_versions_to_compare(stage):
    assert _read(stage, "listings/drafts.json") == [{
        "slug": "contoh", "name": "RUU Contoh", "title": "RUU tentang Contoh", "versions": 2,
        "last": {"stage": "pembicaraan_tingkat_i", "note": "Rapat kerja", "date": "November 2026"},
        "changes": {"from": "ruu_contoh_2026-05_draft", "to": "ruu_contoh_2026-11-19_draft-final"}}]


def test_a_release_missing_a_law_lists_only_the_pages_it_has(tmp_path):
    _, stage = _release(tmp_path, listed=("uu/4/2009",))

    catalog = _read(stage, "law-catalog.json")
    assert [e["id"] for e in catalog["laws"]] == ["uu_4_2009", "ruu_contoh"]
    assert catalog["koleksi"] == []
    assert _read(stage, "listings/overview.json")["total"] == 1
    assert sorted(p.name for p in (stage / "listings" / "years").iterdir()) == ["2009.json"]


def test_a_release_with_no_laws_is_refused(tmp_path):
    data, stage = tmp_path / "data", tmp_path / "stage"
    (data / "peraturan").mkdir(parents=True)
    stage.mkdir()

    with pytest.raises(ValueError, match="no exported law"):
        export_catalog(Laws(data), data, stage)


@pytest.mark.parametrize(("date", "label"), [
    ("2026-11-19", "19 November 2026"), ("2023-05", "Mei 2023"), ("2008", "2008"),
    ("2026-13-01", "1 undefined 2026"),                # as JavaScript prints a month out of range
])
def test_dates_read_as_the_site_prints_them(date, label):
    assert tanggal(date) == label
