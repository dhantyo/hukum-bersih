"""The record schema: every real record fits, a malformed one is refused before it is written,
and saving changes nothing in the YAML the code wrote before the schema existed."""
import copy
from pathlib import Path

import pytest
import yaml
from pydantic import ValidationError
from recfactory import make_record, make_version

from hukum_bersih.records import dump_record, load_record, save_record, validate_record

DATA = Path(__file__).resolve().parents[2] / "data" / "peraturan"
REAL = sorted(DATA.glob("*/*/*/*.yaml"))
needs_data = pytest.mark.skipif(not REAL, reason="data/peraturan is not checked out")


def valid() -> dict:
    rec = make_record("uu_5_2026", versions=[make_version("uu_5_2026", "2026-01-02")])
    rec["bpk"] = {"id": 1, "files": [{"url": "u", "bpk_file_id": 2, "filename": "f.pdf"}],
                  "status_peraturan": {"Mengubah": [{"id": None, "citation": "UU No. 1 Tahun 2000",
                                                     "tentang": None, "url": None, "note": None}]}}
    return rec


@needs_data
def test_every_real_record_validates():
    bad = []
    for path in REAL:
        try:
            load_record(path)
        except ValueError as e:
            bad.append(f"{path.name}: {str(e)[:200]}")
    assert not bad, "\n".join(bad[:10])


@needs_data
def test_save_is_byte_identical_to_the_current_dump(tmp_path):
    for path in REAL[::25]:                        # every 25th record: ~77 laws, all eras
        rec = yaml.safe_load(path.read_text())
        out = tmp_path / path.name
        save_record(out, rec)
        assert out.read_bytes() == path.read_bytes(), path.name
        assert out.read_text() == yaml.safe_dump(rec, allow_unicode=True, sort_keys=False)


def test_a_minimal_record_is_valid():
    assert validate_record(valid())["id"] == "uu_5_2026"


def test_unknown_key_is_rejected():
    rec = valid()
    rec["tanggal_pengundangann"] = "2026-01-02"           # a misspelt key
    with pytest.raises(ValidationError, match="tanggal_pengundangann"):
        validate_record(rec)


@pytest.mark.parametrize("where", ["record", "version", "relationships", "bpk", "bpk file", "status ref"])
def test_unknown_key_in_a_nested_part_is_rejected(where):
    rec = valid()
    target = {"record": rec, "version": rec["versions"][0], "relationships": rec["relationships"],
              "bpk": rec["bpk"], "bpk file": rec["bpk"]["files"][0],
              "status ref": rec["bpk"]["status_peraturan"]["Mengubah"][0]}[where]
    target["oops"] = 1
    with pytest.raises(ValidationError, match="oops"):
        validate_record(rec)


@pytest.mark.parametrize("path,value", [
    (("year",), "2026"),                               # a number as text
    (("number",), 5),                                  # a text as number
    (("tanggal_penetapan",), "2 Januari 2026"),        # not YYYY-MM-DD
    (("versions", 0, "pasal_count"), "12"),
    (("versions", 0, "ocr"), 1),
    (("relationships", "amends"), ["uu_1_2000"]),     # an id, not an entry
    (("bpk", "files", 0, "bpk_file_id"), "2"),
])
def test_wrong_type_is_rejected(path, value):
    rec = valid()
    node = rec
    for key in path[:-1]:
        node = node[key]
    node[path[-1]] = value
    with pytest.raises(ValidationError):
        validate_record(rec)


def test_missing_required_key_is_rejected():
    rec = valid()
    del rec["versions"]
    with pytest.raises(ValidationError, match="versions"):
        validate_record(rec)


def test_save_refuses_and_writes_nothing(tmp_path):
    rec = valid()
    rec["staus"] = "berlaku"
    out = tmp_path / "uu_5_2026.yaml"
    with pytest.raises(ValueError, match="staus"):
        save_record(out, rec)
    assert not out.exists()
    out.write_text("old")                              # nor does it touch what is there
    with pytest.raises(ValueError):
        save_record(out, rec)
    assert out.read_text() == "old"


def test_load_refuses_a_malformed_file(tmp_path):
    out = tmp_path / "x.yaml"
    out.write_text(yaml.safe_dump({"id": "uu_5_2026"}))
    with pytest.raises(ValueError, match="x.yaml"):
        load_record(out)


def test_roundtrip_keeps_the_dict_and_its_key_order(tmp_path):
    rec = valid()
    before = copy.deepcopy(rec)
    out = tmp_path / "r.yaml"
    save_record(out, rec)
    assert rec == before                               # validation does not change the dict
    loaded = load_record(out)
    assert loaded == rec and list(loaded) == list(rec)
    assert dump_record(rec) == out.read_text()

