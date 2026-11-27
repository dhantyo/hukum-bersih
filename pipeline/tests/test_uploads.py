import pytest

from hukum_rapih.uploads import id_from_filename


@pytest.mark.parametrize("name, work", [
    ("UU Nomor 4 Tahun 2009.pdf", "uu_4_2009"),
    ("UU No. 19 Tahun 2003.pdf", "uu_19_2003"),
    ("uu-no-40-tahun-2007.pdf", "uu_40_2007"),
    ("UU_25_2007.pdf", "uu_25_2007"),
    ("UU0042009.pdf", "uu_4_2009"),
    ("Undang-Undang Nomor 11 Tahun 2008.pdf", "uu_11_2008"),
    ("PP Nomor 96 Tahun 2021.pdf", "pp_96_2021"),
])
def test_id_from_filename(name, work):
    assert id_from_filename(name) == work


def test_unknown_name():
    assert id_from_filename("salinan.pdf") is None


def test_placeholder_date_is_unknown():
    from hukum_rapih.sources.peraturan_go_id import tanggal_iso

    assert tanggal_iso("01 Januari 1970") is None       # peraturan.go.id's empty date
    assert tanggal_iso("12 Januari 2009") == "2009-01-12"


def test_import_pdf_records_the_hash_and_converts_without_uploading(tmp_path, monkeypatch):
    import json

    import yaml
    from recfactory import make_record

    from hukum_rapih import uploads

    folder = tmp_path / "peraturan" / "uu" / "2009" / "uu_4_2009"
    folder.mkdir(parents=True)
    (folder / "uu_4_2009.yaml").write_text(yaml.safe_dump(
        make_record("uu_4_2009", tanggal_penetapan="2009-01-12")))
    pdf = tmp_path / "UU Nomor 4 Tahun 2009.pdf"
    pdf.write_bytes(b"%PDF-1.4 test")
    monkeypatch.setattr("hukum_rapih.sources.peraturan_go_id.convert_pdf",
                        lambda *a, **k: "converted")
    line = uploads.import_pdf(pdf, tmp_path, "peraturan.bpk.go.id", "https://peraturan.bpk.go.id/")
    assert line == "ok   uu_4_2009: converted"
    m = [json.loads(x) for x in (tmp_path / "sources/manifests/peraturan.bpk.go.id.jsonl")
         .read_text().splitlines()]
    assert len(m[0]["sha256"]) == 64 and m[0]["archive_url"] is None
    assert m[0]["doc_id"] == "uu_4_2009_2009-01-12"
