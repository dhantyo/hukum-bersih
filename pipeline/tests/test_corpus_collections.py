"""The records of a collection, as ``hukum-bersih export-corpus`` writes them to
``collections/<slug>/`` (hukum_bersih.corpus.collection_export)."""

import json
from pathlib import Path

import pytest
import yaml
from recfactory import make_record, make_version
from test_amendments import AMENDING

from hukum_bersih.corpus.collection_export import export_collections
from hukum_bersih.corpus.laws import Laws
from hukum_bersih.history import build as build_history

BASE_TEXT = """PREFACE
  UNDANG-UNDANG REPUBLIK INDONESIA NOMOR 4 TAHUN 2009

BODY
  CHAPTER I - KETENTUAN UMUM
    ART 4 -
      PARA (1)
        Mineral dikuasai oleh Negara, jang ditetapkan di Djakarta.

      PARA (2)
        Penguasaan diselenggarakan oleh Pemerintah.

    ART 7 -
      Izin diberikan oleh menteri.
"""
# an amending law whose fourth instruction changes the wording of a pasal it does not name
UNAPPLIED = AMENDING.replace(
    "POINT 4.\n      Ketentuan Pasal 5 tetap dengan perubahan penjelasan ayat (1) sehingga "
    "penjelasan Pasal 5 menjadi sebagaimana ditetapkan dalam penjelasan.",
    "POINT 4.\n      Ketentuan huruf d diubah.")
CHANGES = {"diubah": ["4"], "disisipkan": ["27A", "27B"], "dihapus": ["7"]}


def _law(root: Path, law_id: str, text: str | None, **over) -> None:
    year = law_id.split("_")[2]
    folder = root / "peraturan" / "uu" / year / law_id
    folder.mkdir(parents=True)
    versions = []
    if text is not None:
        (folder / f"{law_id}_{year}-01-01.txt").write_text(text, encoding="utf-8")
        versions = [make_version(law_id, f"{year}-01-01", pasal_count=2)]
    relationships = {"amends": [], "amended_by": [], "revokes": [], "revoked_by": [],
                     **over.pop("relationships", {})}
    record = make_record(law_id, versions=versions, relationships=relationships, **over)
    (folder / f"{law_id}.yaml").write_text(yaml.safe_dump(record, allow_unicode=True))


def _export(data: Path, out: Path) -> Path:
    build_history(data)
    export_collections(Laws(data), out)
    return out / "collections"


def _read(folder: Path, name: str) -> dict:
    return json.loads((folder / f"{name}.json").read_text(encoding="utf-8"))


def _amended_family(root: Path, amending_text: str, order: int) -> None:
    _law(root, "uu_4_2009", BASE_TEXT, tentang="PERTAMBANGAN MINERAL DAN BATUBARA",
         status="diubah", tanggal_penetapan="2009-01-12",
         relationships={"amended_by": ["uu_3_2020"]})
    _law(root, "uu_3_2020", amending_text, tentang="PERUBAHAN ATAS UNDANG-UNDANG NOMOR 4 TAHUN 2009",
         tanggal_penetapan="2020-06-10", tanggal_berlaku="2020-06-10",
         relationships={"amends": [{"id": "uu_4_2009", "order": order, "changes": CHANGES}]})


@pytest.fixture
def merged(tmp_path):
    """A named collection: a law and the one law that amends it, whose text we can read."""
    data = tmp_path / "data"
    _amended_family(data, AMENDING, order=1)
    (data / "koleksi").mkdir()
    (data / "koleksi" / "tambang.yaml").write_text(
        yaml.safe_dump({"slug": "uu-tambang", "name": "UU Tambang", "base": "uu_4_2009"}))
    return _export(data, tmp_path / "out") / "uu-tambang"


def test_a_collection_with_a_text_has_the_merged_text_as_latest(merged):
    assert sorted(p.name for p in merged.iterdir()) == [
        "comparisons", "latest.json", "perubahan.json"]
    assert sorted(p.name for p in (merged / "comparisons").iterdir()) == [
        "index.json", "uu_4_2009...uu_3_2020.json"]
    record = _read(merged, "latest")
    assert (record["date"], record["title"], record["baseTitle"]) == (
        "2020-06-10", "UU Tambang", "Undang-Undang Nomor 4 Tahun 2009")
    assert record["status"] == {"key": "diubah", "label": "Diubah"}
    assert record["amended"] == 1
    assert record["amendments"] == [{"label": "UU 3/2020", "href": "/uu/3/2020/"}]
    assert record["facts"] == [
        {"label": "Undang-undang pokok", "value": "UU 4/2009", "href": "/uu/4/2009/"},
        {"label": "Perubahan ke-1", "value": "UU 3/2020", "href": "/uu/3/2020/"}]
    assert [(v["label"], v["href"], v["inForce"]) for v in record["versions"]] == [
        ("Teks asli", "/uu/4/2009/", False), ("Setelah UU 3/2020", "/koleksi/uu-tambang/", True)]
    assert record["incomplete"] is False and record["unreadable"] == []


def test_the_merged_text_applies_each_change_and_marks_it(merged):
    record = _read(merged, "latest")
    chapter = record["text"]["body"][0]
    articles = {a["num"]: a for a in chapter["children"]}
    assert list(articles) == ["4", "7", "27A", "27B"]               # new pasal follow the last one
    assert articles["27A"]["eId"] == "chp_I__art_27A"
    assert articles["4"]["children"][0]["children"][0]["text"] == "Mineral dikuasai oleh negara."
    assert articles["7"]["children"] == []                             # deleted: the heading stays
    assert record["text"]["anchors"] == {
        "chp_I__art_4": "pasal-4", "chp_I__art_7": "pasal-7",
        "chp_I__art_27A": "pasal-27a", "chp_I__art_27B": "pasal-27b"}
    assert {num: [n["kind"] for n in notes] for num, notes in record["notes"].items()} == {
        "4": ["diubah"], "7": ["dihapus"], "27A": ["disisipkan"], "27B": ["disisipkan"]}
    assert record["notes"]["4"] == [{"kind": "diubah", "label": "UU 3/2020",
                                     "href": "/uu/3/2020/", "by": "uu_3_2020"}]


def test_the_original_wording_is_kept_as_printed_beside_each_amendment(merged):
    data = _read(merged, "perubahan")
    assert [(v["id"], v["label"], v["cite"], v["date"], v["gap"]) for v in data["versions"]] == [
        ("uu_4_2009", "Teks asli (2009)", "UU 4/2009", "2009-01-12", 0),
        ("uu_3_2020", "UU 3/2020", "UU 3/2020", "2020-06-10", 0)]
    by_pasal = dict(data["pasal"])
    assert list(by_pasal) == ["4", "7", "27A", "27B"]
    # [version, how the pasal reads there]; a line is [number, text, indent]
    assert by_pasal["4"][0] == [0, [
        ["(1)", "Mineral dikuasai oleh Negara, jang ditetapkan di Djakarta.", 0],
        ["(2)", "Penguasaan diselenggarakan oleh Pemerintah.", 0]]]
    assert by_pasal["4"][1][1][0] == ["(1)", "Mineral dikuasai oleh negara.", 0]
    assert by_pasal["7"] == [[0, [[None, "Izin diberikan oleh menteri.", 0]]], [1, "d"]]
    assert by_pasal["27A"] == [[0, None], [1, [[None, "Setiap orang wajib.", 0]]]]


def test_a_missing_amendment_and_an_unapplied_instruction_leave_the_collection_incomplete(tmp_path):
    data = tmp_path / "data"
    _amended_family(data, UNAPPLIED, order=2)                  # "perubahan kedua": no first one
    folder = _export(data, tmp_path / "out") / "pertambangan-mineral-dan-batubara"
    record = _read(folder, "latest")
    assert record["incomplete"] is True and record["missing"] == 1
    assert [(v["label"], v["sub"], v["missing"]) for v in record["versions"]][1] == (
        "Perubahan pertama", "belum tersedia di sini", True)
    assert record["unapplied"] == [{
        "header": "Ketentuan huruf d diubah.", "instruction": 4,
        "by": {"label": "UU 3/2020", "href": "/uu/3/2020/"}}]
    assert _read(folder, "perubahan")["versions"][1]["gap"] == 1


def test_a_collection_without_a_text_is_a_timeline(tmp_path):
    data = tmp_path / "data"
    _law(data, "uu_5_2000", None, tentang="CIPTA KERJA", tanggal_penetapan="2000-03-01",
         status="dicabut",
         relationships={"amended_by": ["uu_6_2010"], "revoked_by": ["uu_99_2020"]})
    _law(data, "uu_6_2010", None, tentang="PERUBAHAN KEDUA", tanggal_penetapan="2010-05-02",
         relationships={"amends": [{"id": "uu_5_2000", "order": 2,
                                    "changes": {"diubah": ["3"], "dihapus": ["9"]}}]})
    folder = _export(data, tmp_path / "out") / "cipta-kerja"
    assert [p.name for p in folder.iterdir()] == ["timeline.json"]
    record = _read(folder, "timeline")
    assert (record["count"], record["amended"], record["detailed"]) == (2, 2, False)
    assert record["status"] == {"key": "dicabut", "label": "Dicabut"}
    kinds = [(e["kind"], e["dotted"]) for e in record["events"]]
    assert kinds == [("pokok", True), ("tidak-tersedia", True), ("perubahan", True),
                     ("tidak-tersedia", True)]
    base, gap, amendment, revoker = record["events"]
    assert base["role"] == "Undang-undang pokok" and base["noText"] is True
    assert base["status"] == {"key": "dicabut", "label": "Dicabut"}
    assert gap["what"] == "Perubahan pertama" and "UU Cipta Kerja" in gap["why"]
    assert amendment["role"] == "Perubahan kedua"
    assert [(g["key"], g["label"], g["items"]) for g in amendment["changes"]] == [
        ("diubah", "Diubah", [{"num": "3"}]), ("dihapus", "Dihapus", [{"num": "9"}])]
    assert "compareHref" not in amendment
    assert (revoker["what"], revoker["id"]) == ("Undang-undang yang mencabut", "UU 99/2020")


def test_every_dated_version_has_its_own_record(tmp_path):
    data = tmp_path / "data"
    second = AMENDING.replace("NOMOR 3 TAHUN 2020", "NOMOR 5 TAHUN 2022").replace(
        "Mineral dikuasai oleh negara.", "Mineral dikuasai oleh negara sepenuhnya.")
    _law(data, "uu_4_2009", BASE_TEXT, tentang="PERTAMBANGAN", tanggal_penetapan="2009-01-12",
         relationships={"amended_by": ["uu_3_2020", "uu_5_2022"]})
    _law(data, "uu_3_2020", AMENDING, tentang="PERUBAHAN", tanggal_penetapan="2020-06-10",
         tanggal_berlaku="2020-06-10",
         relationships={"amends": [{"id": "uu_4_2009", "order": 1, "changes": CHANGES}]})
    _law(data, "uu_5_2022", second, tentang="PERUBAHAN KEDUA", tanggal_penetapan="2022-03-01",
         tanggal_berlaku="2022-03-01",
         relationships={"amends": [{"id": "uu_4_2009", "order": 2, "changes": CHANGES}]})
    folder = _export(data, tmp_path / "out") / "pertambangan"
    assert sorted(p.name for p in folder.iterdir()) == [
        "2020-06-10.json", "comparisons", "latest.json", "perubahan.json"]
    wording = {name: _read(folder, name)["text"]["body"][0]["children"][0]["children"][0][
        "children"][0]["text"] for name in ("2020-06-10", "latest")}
    assert wording == {"2020-06-10": "Mineral dikuasai oleh negara.",
                       "latest": "Mineral dikuasai oleh negara sepenuhnya."}
    assert [(v["label"], v["href"]) for v in _read(folder, "latest")["versions"]] == [
        ("Teks asli", "/uu/4/2009/"), ("Setelah UU 3/2020", "/koleksi/pertambangan/2020-06-10/"),
        ("Setelah UU 5/2022", "/koleksi/pertambangan/")]
    assert [v["id"] for v in _read(folder, "perubahan")["versions"]] == [
        "uu_4_2009", "uu_3_2020", "uu_5_2022"]
