from pathlib import Path

import pytest

from hukum_bersih.sources import peraturan_bpk as bpk

FIX = Path(__file__).parent / "fixtures" / "bpk"


def page(name: str) -> str:
    return (FIX / name).read_text()


def test_listing():
    items = bpk.parse_listing(page("search_uu_p1.html"))
    assert items[0] == bpk.Listing("/Details/350096/uu-no-5-tahun-2026", 350096)
    assert len(items) == 10 and len({i.bpk_id for i in items}) == 10   # 10 results a page
    assert bpk.last_page(page("search_uu_p1.html")) == 193           # 1,929 UU


@pytest.mark.parametrize("cite, work", [
    ("UU No. 2 Tahun 2025", "uu_2_2025"),
    ("PERPU No. 2 Tahun 2022", "perppu_2_2022"),
    ("PP No. 96 Tahun 2021", "pp_96_2021"),
    ("Staatsblad Tahun 1926 Nomor 226", None),
])
def test_cite_to_id(cite, work):
    assert bpk.cite_to_id(cite) == work


def test_detail_uu_4_2009():
    d = bpk.parse_detail(page("details_uu_4_2009.html"))
    m = d["meta"]
    assert m["Nomor"] == "4" and m["Tahun"] == "2009" and m["Bentuk Singkat"] == "UU"
    assert m["Judul"] == "Undang-undang (UU) Nomor 4 Tahun 2009 tentang Pertambangan Mineral dan Batubara"
    assert m["Tanggal Pengundangan"] == "12 Januari 2009"
    assert m["Sumber"].startswith("LN. 2009/ No. 4")
    assert d["files"] == [{"url": "https://peraturan.bpk.go.id/Download/27833/UU%20Nomor%204%20Tahun%202009.pdf",
                           "bpk_file_id": 27833, "filename": "UU Nomor 4 Tahun 2009.pdf"}]
    assert [u["putusan"] for u in d["uji_materi"]] == ["25/PUU-VII/2010"]
    assert "Pasal 22 huruf e" in d["uji_materi"][0]["amar"]
    s = d["status_peraturan"]
    assert [e["id"] for e in s["Diubah dengan"]] == [
        "uu_2_2025", "uu_6_2023", "perppu_2_2022", "uu_3_2020", "uu_11_2020"]
    assert s["Mencabut"][0]["id"] == "uu_11_1967"


def test_detail_status_notes_and_unlinked():
    s = bpk.parse_detail(page("details_uu_6_2023.html"))["status_peraturan"]
    partly = s["Dicabut sebagian dengan"][0]
    assert partly["id"] == "uu_27_2026" and partly["tentang"] == "Pelindungan Ketenagakerjaan"
    assert partly["note"].startswith("Bab IV Bagian Kesatu Pasal 80")
    assert any(e["id"] is None and e["citation"].startswith("Staatsblad") for e in s["Mencabut"])
    assert s["Diubah dengan"][0]["note"] is None


def test_update_existing_record_keeps_ours():
    d = bpk.parse_detail(page("details_uu_4_2009.html"))
    rec = {"id": "uu_4_2009", "tentang": "PERTAMBANGAN MINERAL DAN BATUBARA", "status": "berlaku",
           "tanggal_penetapan": "2009-01-12", "tempat_penetapan": "Jakarta", "year": 2009,
           "source_url": "https://peraturan.go.id/id/uu-no-4-tahun-2009",
           "source_pdf_url": "https://peraturan.go.id/files/uu4-2009bt.pdf", "versions": []}
    url = "https://peraturan.bpk.go.id/Details/38578/uu-no-4-tahun-2009"
    rec, notes = bpk.update_record(rec, d, "uu", url)
    assert notes == []
    assert rec["tentang"] == "PERTAMBANGAN MINERAL DAN BATUBARA"           # not overwritten
    assert rec["tanggal_pengundangan"] == "2009-01-12"
    assert rec["source_url"] == url and rec["source_pdf_url"].endswith("/Download/27833/UU%20Nomor%204%20Tahun%202009.pdf")
    assert rec["other_sources"] == [{"source_url": "https://peraturan.go.id/id/uu-no-4-tahun-2009",
                                     "source_pdf_url": "https://peraturan.go.id/files/uu4-2009bt.pdf"}]
    assert rec["bpk"]["id"] == 38578
    rec, _ = bpk.update_record(rec, d, "uu", url)                          # idempotent
    assert len(rec["other_sources"]) == 1


def test_differing_date_is_recorded_not_swapped():
    d = bpk.parse_detail(page("details_uu_4_2009.html"))
    rec = {"id": "uu_4_2009", "tanggal_penetapan": "2009-01-13", "year": 2009, "versions": []}
    rec, notes = bpk.update_record(rec, d, "uu", "https://peraturan.bpk.go.id/Details/38578/x")
    assert rec["tanggal_penetapan"] == "2009-01-13" and rec["tanggal_penetapan_bpk"] == "2009-01-12"
    assert notes and "differs" in notes[0]


def test_new_record():
    d = bpk.parse_detail(page("details_uu_5_2026.html"))
    rec, _ = bpk.update_record(None, d, "uu", "https://peraturan.bpk.go.id/Details/350096/uu-no-5-tahun-2026")
    assert rec["id"] == "uu_5_2026" and rec["akn"] == "/akn/id/act/uu/2026/5"
    assert rec["title"].startswith("Undang-Undang Nomor 5 Tahun 2026 tentang Perubahan Ketiga")
    assert rec["tanggal_penetapan"] == "2026-06-17" and rec["status"] == "berlaku"


def test_file_ids_skip_taken_names():
    v = "uu_4_2009_2009-01-12"
    assert bpk.file_ids(v, "uu_4_2009", 1, set()) == (v, f"{v}.pdf")
    assert bpk.file_ids(v, "uu_4_2009", 1, {f"{v}.pdf"}) == (f"{v}_2", f"{v}_2.pdf")
    assert bpk.file_ids(v, "uu_4_2009", 2, set()) == (f"{v}_2", f"{v}_2.pdf")


class FakeResponse:
    def __init__(self, content: bytes, ctype: str):
        self.content, self.text = content, content.decode("latin-1")
        self.headers = {"content-type": ctype}


class FakeSession:
    """Serves the saved detail page and a small generated PDF; counts requests."""

    def __init__(self, detail: str, pdf: bytes):
        self.detail, self.pdf, self.calls = detail, pdf, []

    def get(self, url):
        self.calls.append(url)
        if "/Download/" in url:
            return FakeResponse(self.pdf, "application/pdf")
        return FakeResponse(page(self.detail).encode(), "text/html")


def small_pdf() -> bytes:
    import pymupdf

    doc = pymupdf.open()
    doc.new_page().insert_text((72, 72), "UNDANG-UNDANG REPUBLIK INDONESIA")
    return doc.tobytes()


def test_import_existing_record_keeps_text_and_records_pdf(tmp_path):
    import json

    import yaml

    folder = tmp_path / "peraturan" / "uu" / "2009" / "uu_4_2009"
    folder.mkdir(parents=True)
    (folder / "uu_4_2009_2009-01-12.txt").write_text("text from peraturan.go.id")
    rec = {"id": "uu_4_2009", "type": "uu", "number": "4", "year": 2009, "tentang": "X",
           "tanggal_penetapan": "2009-01-12", "status": "berlaku",
           "source_url": "https://peraturan.go.id/id/uu-no-4-tahun-2009",
           "source_pdf_url": "https://peraturan.go.id/files/uu4-2009bt.pdf",
           "versions": [{"id": "uu_4_2009_2009-01-12", "text": "uu_4_2009_2009-01-12.txt",
                         "pasal_count": 175}]}
    (folder / "uu_4_2009.yaml").write_text(yaml.safe_dump(rec))
    s = FakeSession("details_uu_4_2009.html", small_pdf())
    item = bpk.Listing("/Details/38578/uu-no-4-tahun-2009", 38578)
    known: dict = {}

    line = bpk.import_one(s, item, "uu", tmp_path, known, do_archive=False)
    assert line.startswith("ok   uu_4_2009: 1 PDF recorded; kept text (175 pasal")
    out = yaml.safe_load((folder / "uu_4_2009.yaml").read_text())
    assert (folder / "uu_4_2009_2009-01-12.txt").read_text() == "text from peraturan.go.id"
    assert out["versions"] == rec["versions"]
    assert out["bpk"]["files"][0]["sha256"] and out["tanggal_pengundangan"] == "2009-01-12"
    m = [json.loads(x) for x in (tmp_path / "sources" / "manifests" / "peraturan.bpk.go.id.jsonl")
         .read_text().splitlines()]
    assert m[0]["doc_id"] == "uu_4_2009_2009-01-12" and m[0]["archive_url"] is None
    assert m[0]["original_filename"] == "UU Nomor 4 Tahun 2009.pdf"

    n = len(s.calls)                       # resumes: nothing fetched again
    assert bpk.import_one(s, item, "uu", tmp_path, known, do_archive=False).startswith("skip")
    assert len(s.calls) == n


def test_import_new_record(tmp_path):
    import yaml

    s = FakeSession("details_uu_5_2026.html", small_pdf())
    line = bpk.import_one(s, bpk.Listing("/Details/350096/uu-no-5-tahun-2026", 350096), "uu",
                          tmp_path, {}, do_archive=False)
    assert line.startswith("ok   uu_5_2026: 1 PDF recorded; no pasal found")
    rec = yaml.safe_load((tmp_path / "peraturan/uu/2026/uu_5_2026/uu_5_2026.yaml").read_text())
    assert rec["source_url"].endswith("/Details/350096/uu-no-5-tahun-2026")
    assert "other_sources" not in rec and rec["pdf_quality"] == "image_only_or_unparsed"


def test_not_a_pdf_fails_without_writing_manifest(tmp_path):
    s = FakeSession("details_uu_5_2026.html", b"<html>challenge</html>")
    with pytest.raises(RuntimeError, match="not a PDF"):
        bpk.import_one(s, bpk.Listing("/Details/350096/uu-no-5-tahun-2026", 350096), "uu",
                       tmp_path, {}, do_archive=False)
    assert not (tmp_path / "sources").exists()


def test_find_picks_the_exact_regulation():
    class S:
        def get(self, url):
            assert "&tahun=2026&jenis=8" in url and "nomor=" in url
            return FakeResponse(page("search_uu_p1.html").encode(), "text/html")

    assert bpk.find(S(), "uu_5_2026") == bpk.Listing("/Details/350096/uu-no-5-tahun-2026", 350096)
    with pytest.raises(LookupError):
        bpk.find(S(), "uu_99_2026")


def test_no_text_leaves_record_without_text(tmp_path):
    import yaml

    s = FakeSession("details_uu_5_2026.html", small_pdf())
    line = bpk.import_one(s, bpk.Listing("/Details/350096/uu-no-5-tahun-2026", 350096), "uu",
                          tmp_path, {}, do_archive=False, no_text=True)
    assert line.endswith("PDFs only (no text step)")
    rec = yaml.safe_load((tmp_path / "peraturan/uu/2026/uu_5_2026/uu_5_2026.yaml").read_text())
    assert rec["versions"] == [] and "pdf_quality" not in rec
