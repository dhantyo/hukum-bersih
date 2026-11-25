"""The reader record of a law, as ``hukum-bersih export-corpus`` writes it to
``laws/uu/<number>/<year>/index.json`` (hukum_bersih.corpus.laws)."""

import json
from pathlib import Path

import pytest
import yaml
from recfactory import make_record, make_version
from test_amendments import AMENDING

from hukum_bersih.corpus.laws import Laws, export_laws
from hukum_bersih.corpus.search import SearchRecords
from hukum_bersih.history import build as build_history

# Old spelling stays as printed. Pasal 7 is printed twice (a renumbered law), and Pasal 27A
# carries a letter.
BASE_TEXT = """PREFACE
  UNDANG-UNDANG REPUBLIK INDONESIA NOMOR 4 TAHUN 2009

BODY
  CHAPTER I - KETENTUAN UMUM
    ART 4 -
      PARA (1)
        Mineral dikuasai oleh Negara, jang ditetapkan di Djakarta pada bulan Nopember.

      PARA (2)
        Penguasaan diselenggarakan oleh Pemerintah.

    ART 7 -
      Izin diberikan oleh menteri.

    ART 7 -
      Izin dicabut oleh menteri.

    ART 27A -
      Setiap orang wajib menjaga.

ATTACHMENT Penjelasan
  PART - PENDJELASAN
    Cukup djelas.
"""


def _law(root: Path, law_id: str, text: str | None, **over) -> None:
    year = law_id.split("_")[2]
    folder = root / "peraturan" / "uu" / year / law_id
    folder.mkdir(parents=True)
    versions = []
    if text is not None:
        (folder / f"{law_id}_{year}-01-01.txt").write_text(text, encoding="utf-8")
        versions = [make_version(law_id, f"{year}-01-01", pasal_count=4)]
    record = make_record(law_id, versions=versions, **over)
    (folder / f"{law_id}.yaml").write_text(yaml.safe_dump(record, allow_unicode=True))


def _relations(**over) -> dict:
    return {"amends": [], "amended_by": [], "revokes": [], "revoked_by": [], **over}


@pytest.fixture
def stage(tmp_path):
    """An amended law, the law that amends it, and a law whose text we do not have."""
    data, out = tmp_path / "data", tmp_path / "stage"
    changes = {"diubah": ["10", "4"], "disisipkan": ["27A", "27B"], "dihapus": ["7"]}
    _law(data, "uu_4_2009", BASE_TEXT, tentang="PERTAMBANGAN MINERAL DAN BATUBARA",
         status="diubah", tanggal_penetapan="2009-01-12", tempat_penetapan="Djakarta",
         pejabat_penetapan="PRESIDEN REPUBLIK INDONESIA",
         source_url="https://peraturan.bpk.go.id/Details/38578/uu-no-4-tahun-2009",
         relationships=_relations(amended_by=["uu_3_2020"]))
    _law(data, "uu_3_2020", AMENDING, tentang="PERUBAHAN ATAS UNDANG-UNDANG NOMOR 4 TAHUN 2009",
         tanggal_penetapan="2020-06-10", tanggal_berlaku="2020-06-10",
         relationships=_relations(amends=[{"id": "uu_4_2009", "order": 1, "changes": changes}]))
    _law(data, "uu_9_2010", None, tentang="PERTANIAN", pdf_quality="scan")
    build_history(data)
    export_laws(Laws(data), out, SearchRecords())
    return out


def _read(stage: Path, number: int, year: int) -> dict:
    return json.loads((stage / "laws" / "uu" / str(number) / str(year) / "index.json").read_text())


def _texts(nodes: list[dict]) -> list[str]:
    return [t for n in nodes for t in ([n["text"]] if n["tag"] == "p" else _texts(n["children"]))]


def test_one_file_per_law_and_no_scratch_folder_left(stage):
    assert sorted(p.parent.relative_to(stage / "laws").as_posix()
                  for p in (stage / "laws").rglob("index.json")) == [
        "uu/3/2020", "uu/4/2009", "uu/9/2010"]
    assert [p.name for p in stage.iterdir()] == ["laws"]


def test_an_amended_law_lists_what_changed_it_and_where(stage):
    law = _read(stage, 4, 2009)

    assert (law["title"], law["subject"], law["statusLabel"]) == (
        "Undang-Undang Nomor 4 Tahun 2009", "Pertambangan Mineral dan Batubara", "Diubah")
    assert (law["cite"], law["date"], law["place"], law["sourceName"]) == (
        "UU 4/2009", "2009-01-12", "Djakarta", "JDIH BPK")
    assert law["amendmentCount"] == 1 and law["pasalCount"] == 4
    assert law["family"]["name"] == "Pertambangan Mineral dan Batubara"
    assert [v["label"] for v in law["family"]["versions"]] == ["Teks asli", "Setelah UU 3/2020"]
    assert law["family"]["comparable"] is True
    assert law["perubahanTarget"] == "/koleksi/pertambangan-mineral-dan-batubara/"
    assert "archive" not in law and "shortName" not in law and "missingText" not in law


def test_pasal_notes_list_integer_numbers_first_and_link_only_pasal_that_can_be_compared(stage):
    notes = _read(stage, 4, 2009)["notes"]

    assert list(notes) == ["4", "7", "10"]
    assert notes["4"] == [{"label": "UU 3/2020", "href": "/uu/3/2020/", "by": "uu_3_2020"}]
    assert "by" in notes["7"][0] and "by" not in notes["10"][0]


def test_the_amending_law_knows_its_place_and_its_target(stage):
    law = _read(stage, 3, 2020)

    assert law["family"]["role"] == "Perubahan pertama"
    assert law["family"]["comparable"] is False
    assert law["relations"] == [{
        "verb": "mengubah", "count": 5, "history": True,
        "label": "UU 4/2009 tentang Pertambangan Mineral dan Batubara", "href": "/uu/4/2009/"}]
    assert [v["made"] for v in law["family"]["versions"]] == [False, True]
    assert law["perubahanTarget"] == "/koleksi/pertambangan-mineral-dan-batubara/"


def test_old_spelling_is_kept_as_printed(stage):
    text = _read(stage, 4, 2009)["text"]

    assert "Mineral dikuasai oleh Negara, jang ditetapkan di Djakarta pada bulan Nopember." \
        in _texts(text["body"])
    assert [(part["heading"], _texts([part])) for part in text["penjelasan"]] == [
        ("PENDJELASAN", ["Cukup djelas."])]


def test_a_pasal_printed_twice_with_one_number_has_one_anchor(stage):
    text = _read(stage, 4, 2009)["text"]
    chapter = text["body"][0]

    assert [a["num"] for a in chapter["children"]] == ["4", "7", "7", "27A"]
    assert text["anchors"] == {
        "chp_I__art_4": "pasal-4", "chp_I__art_7": "pasal-7", "chp_I__art_27A": "pasal-27a"}


def test_a_law_without_text_says_why_and_has_no_text(stage):
    law = _read(stage, 9, 2010)

    assert law["text"] is None
    assert law["missingText"] == "ocr"
    assert "pasalCount" not in law and "family" not in law
    assert law["notes"] == {} and law["relations"] == []
    assert law["perubahanTarget"] == "/uu/9/2010/"
