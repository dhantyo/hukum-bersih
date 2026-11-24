"""The versions of an amended law and its changes (hukum_bersih.history, decision 0010)."""

from pathlib import Path

import yaml
from recfactory import make_record, make_version
from test_amendments import AMENDING

from hukum_bersih.history import build, history_of

BASE_TEXT = """BODY
  ART 4 -
    Mineral dikuasai negara.

  ART 7 -
    Izin diberikan oleh menteri.
"""


def _law(root: Path, rid: str, rel: dict, text: str | None = None, **over) -> None:
    year = rid.split("_")[2]
    d = root / "peraturan" / "uu" / year / rid
    d.mkdir(parents=True, exist_ok=True)
    versions = []
    if text is not None:
        (d / f"{rid}_{year}-01-01.txt").write_text(text)
        versions = [make_version(rid, f"{year}-01-01")]
    relationships = {"amends": [], "amended_by": [], "revokes": [], "revoked_by": [], **rel}
    rec = make_record(rid, relationships=relationships, versions=versions, **over)
    (d / f"{rid}.yaml").write_text(yaml.safe_dump(rec))


def _setup(root: Path, order: int = 1, amending_text: str = AMENDING) -> None:
    _law(root, "uu_4_2009", {"amended_by": ["uu_3_2020"]}, BASE_TEXT,
         tanggal_penetapan="2009-01-12")
    _law(root, "uu_3_2020", {"amends": [{"id": "uu_4_2009", "order": order}]}, amending_text,
         tanggal_penetapan="2020-06-10", tanggal_berlaku="2020-06-10")


def _history(root: Path) -> dict:
    build(root)
    return yaml.safe_load((root / "peraturan/uu/2009/uu_4_2009/uu_4_2009.yaml").read_text())["history"]


def test_points_and_changes(tmp_path):
    _setup(tmp_path)
    h = _history(tmp_path)
    asli, merged = h["points"]
    assert (asli["id"], asli["kind"], asli["date_basis"]) == ("uu_4_2009_2009-01-01", "asli", "tanggal_penetapan")
    # dated by when the amendment took effect (docs/NAMING.md), the best date the record has
    assert (merged["id"], merged["kind"], merged["date_basis"]) == ("uu_4_2009_2020-06-10", "gabungan", "tanggal_berlaku")
    assert merged["after"] == ["uu_3_2020"] and merged["counts"] == {"diubah": 1, "disisipkan": 2, "dihapus": 1}
    assert [(c["pasal"], c["type"], c["instruction"], c["wording"]) for c in h["changes"]] == [
        ("4", "diubah", 1, "read"), ("7", "dihapus", 2, "none"),
        ("27A", "disisipkan", 3, "read"), ("27B", "disisipkan", 3, "read")]
    # instruction 4 only changes the Penjelasan: recorded, but the pasal text is still complete
    assert [(n["instruction"], n["affects_wording"]) for n in merged["not_applied"]] == [(4, False)]
    assert merged["complete"] is True


def test_missing_earlier_amendment_makes_it_incomplete(tmp_path):
    _setup(tmp_path, order=2)              # "perubahan kedua", but we have no first amendment
    merged = _history(tmp_path)["points"][1]
    assert merged["missing_before"] == 1 and merged["complete"] is False


def test_unapplied_pasal_instruction_makes_it_incomplete(tmp_path):
    text = AMENDING.replace("POINT 4.\n      Ketentuan Pasal 5 tetap dengan perubahan penjelasan ayat (1) "
                            "sehingga penjelasan Pasal 5 menjadi sebagaimana ditetapkan dalam penjelasan.",
                            "POINT 4.\n      Ketentuan huruf d diubah.")
    _setup(tmp_path, amending_text=text)
    merged = _history(tmp_path)["points"][1]
    assert merged["not_applied"][0]["affects_wording"] is True
    assert merged["complete"] is False


def test_only_amended_laws_get_a_history_and_it_is_idempotent(tmp_path):
    _setup(tmp_path)
    _law(tmp_path, "uu_1_2001", {}, BASE_TEXT)
    assert build(tmp_path)["with_history"] == 1
    assert "history" not in yaml.safe_load((tmp_path / "peraturan/uu/2001/uu_1_2001/uu_1_2001.yaml").read_text())
    assert build(tmp_path)["updated"] == 0


def test_history_of_unamended_is_none():
    assert history_of({"id": "uu_1_2001", "relationships": {"amended_by": []}}, {}, {}) is None
