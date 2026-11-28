"""The UUD 1945, its amendments and Keppres 150/1959 (decision 0027)."""

import pytest
import yaml
from recfactory import make_record, make_version

from hukum_rapih.records import validate_record
from hukum_rapih.relations import build, force_in_text
from hukum_rapih.sources import peraturan_bpk as bpk

URL = "https://peraturan.bpk.go.id" + bpk.UUD_ENTRY
DECREE = ("Menetapkan Undang-Undang Dasar 1945 berlaku lagi bagi segenap Bangsa Indonesia dan seluruh\n"
          "tumpah darah Indonesia, terhitung mulai hari tanggal penetapan Dekrit ini, dan tidak\n"
          "berlakunja lagi Undang-Undang Dasar Sementara.\nDitetapkan di Djakarta\npada tanggal 5 Djuli 1959")


def test_new_uud_records_fit_the_schema(tmp_path):
    uud = validate_record(bpk.uud_record("uud_1945", URL))
    assert uud["number"] is None and uud["akn"] == "/akn/id/act/1945/uud"
    fourth = validate_record(bpk.uud_record("uud-perubahan_4_2002", URL))
    assert fourth["title"] == "Perubahan Keempat Undang-Undang Dasar Negara Republik Indonesia Tahun 1945"
    assert fourth["akn"] == "/akn/id/act/uud-perubahan/2002/4"
    assert bpk.record_path(tmp_path, "uud_1945") == tmp_path / "peraturan/uud/1945/uud_1945/uud_1945.yaml"


def test_the_printed_date_dates_a_record_that_has_none(tmp_path):
    (tmp_path / "uud-perubahan_1_1999_1999.txt").write_text(
        "CONCLUSIONS\n  Ditetapkan di Jakarta\n  Pada tanggal 19 Oktober 1999\n")
    rec = make_record("uud-perubahan_1_1999", versions=[make_version("uud-perubahan_1_1999", "1999")])
    assert bpk.date_printed(rec, tmp_path) == ["uud-perubahan_1_1999: dated 1999-10-19 as printed"]
    assert rec["tanggal_penetapan"] == "1999-10-19"
    assert rec["versions"][0]["id"] == "uud-perubahan_1_1999_1999-10-19"
    assert (tmp_path / "uud-perubahan_1_1999_1999-10-19.txt").exists()


def test_the_decree_is_dated_in_its_old_spelling(tmp_path):
    (tmp_path / "keppres_150_1959_1959.txt").write_text(DECREE)
    rec = make_record("keppres_150_1959", versions=[make_version("keppres_150_1959", "1959")])
    bpk.date_printed(rec, tmp_path)
    assert rec["tanggal_penetapan"] == "1959-07-05"


def test_no_printed_date_keeps_the_bare_year(tmp_path):
    (tmp_path / "uud_1945_1945.txt").write_text("BODY\n  ART 1 -\n    Negara Indonesia ialah Negara Kesatuan\n")
    rec = {**bpk.uud_record("uud_1945", URL), "versions": [make_version("uud_1945", "1945")]}
    assert bpk.date_printed(rec, tmp_path) == ["uud_1945: no date printed, kept 1945"]
    assert rec["tanggal_penetapan"] is None and rec["versions"][0]["id"] == "uud_1945_1945"


# as printed in 1959, and as BPK retyped it
@pytest.mark.parametrize("text", [DECREE, DECREE.replace("berlakunja", "berlakunya")])
def test_the_decree_reinstates_the_uud_and_ends_the_uuds(text):
    assert force_in_text(text) == {"reinstates": ["uud_1945"], "ends": ["uu_7_1950"]}


def test_citing_the_uuds_neither_reinstates_nor_ends():
    assert force_in_text("Mengingat: Undang-Undang Dasar Sementara") == {"reinstates": [], "ends": []}


class _Page:
    def __init__(self, text: str):
        self.text = text


class _Session:
    """BPK's UUD entry with its six files; downloads are stubbed in the test."""

    def get(self, path):
        names = [*bpk.UUD_FILES, bpk.SATU_NASKAH]
        return _Page("".join(f'<a data-kategori="Peraturan" data-id="{n}" href="/Download/{n}/{name}">'
                             for n, name in enumerate(names, start=1)))


def test_import_uud_writes_five_records_and_hashes_each_file_once(tmp_path, monkeypatch):
    monkeypatch.setattr(bpk, "download", lambda session, f, data: (f["filename"].encode(), None))
    monkeypatch.setattr(bpk, "retext", lambda pdf, rec, folder: "converted")
    lines = list(bpk.import_uud(_Session(), tmp_path))
    assert lines == [f"ok   {work}: converted" for work in bpk.UUD_FILES.values()]
    uud = yaml.safe_load(bpk.record_path(tmp_path, "uud_1945").read_text())
    assert [f["filename"] for f in uud["bpk"]["files"]] == ["UUD45.pdf", bpk.SATU_NASKAH]
    assert uud["source_pdf_url"].endswith("/UUD45.pdf") and uud["bpk"]["id"] == 101646
    manifest = tmp_path / "sources/manifests/peraturan.bpk.go.id.jsonl"
    assert len(manifest.read_text().splitlines()) == 6
    list(bpk.import_uud(_Session(), tmp_path))                     # again: nothing new to record
    assert len(manifest.read_text().splitlines()) == 6


def _write(data, rec, text=None):
    folder = bpk.record_path(data, rec["id"]).parent
    folder.mkdir(parents=True)
    if text:
        (folder / rec["versions"][0]["text"]).write_text(text)
    (folder / f"{rec['id']}.yaml").write_text(yaml.safe_dump(rec))


def _rel(data, work):
    return yaml.safe_load(bpk.record_path(data, work).read_text())["relationships"]


def test_relations_of_the_uud(tmp_path):
    _write(tmp_path, bpk.uud_record("uud_1945", URL))
    _write(tmp_path, bpk.uud_record("uud-perubahan_2_2000", URL))
    _write(tmp_path, make_record("uu_7_1950"))
    _write(tmp_path, make_record("keppres_150_1959", versions=[make_version("keppres_150_1959", "1959-07-05")]),
           DECREE)
    _write(tmp_path, make_record("uu_4_2009"))
    build(tmp_path)
    assert _rel(tmp_path, "uud-perubahan_2_2000")["amends"] == [{"id": "uud_1945", "order": 2}]
    assert _rel(tmp_path, "uud_1945")["amended_by"] == ["uud-perubahan_2_2000"]
    assert _rel(tmp_path, "uud_1945")["reinstated_by"] == ["keppres_150_1959"]
    assert _rel(tmp_path, "uu_7_1950")["ended_by"] == ["keppres_150_1959"]
    decree = _rel(tmp_path, "keppres_150_1959")
    assert decree["reinstates"] == ["uud_1945"] and decree["ends"] == ["uu_7_1950"]
    assert "reinstates" not in _rel(tmp_path, "uu_4_2009")        # empty: not written
