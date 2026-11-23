"""Regulations rebuilt from the Hugging Face dataset Azzindani/ID_REG_RAG_2611 (decision 0011).
The chunks below copy the dataset's shape: heading lines only in ``heading_path``, the first
chunk holding the title and the Menimbang text, several headings in one path segment."""

from pathlib import Path

import pytest
import yaml

from hukum_bersih.sources import id_reg_rag as m

REV = "340827221a65de669b9edd28f2a890b0310e30dc"


def chunk(seq, path, body, part_n=1):
    return {"seq": seq, "part_n": part_n, "heading_path": path, "body": body}


PP_CHUNKS = [
    chunk(0, "Menimbang", "PERATURAN PEMERINTAH REPUBLIK INDONESIA\nNOMOR 7 TAHUN 2001 TENTANG\nCONTOH\n\n"
                          ": a. bahwa contoh perlu diatur;\nb. bahwa berdasarkan huruf a, perlu menetapkan Peraturan Pemerintah;"),
    chunk(1, "Mengingat", ": Pasal 5 ayat (2) Undang-Undang Dasar 1945;"),
    chunk(2, "MEMUTUSKAN:", "Menetapkan : PERATURAN PEMERINTAH TENTANG CONTOH."),
    chunk(3, "BAB I KETENTUAN UMUM › Pasal 1.", "Dalam Peraturan Pemerintah ini yang dimaksud dengan contoh adalah contoh."),
    chunk(4, "BAB I KETENTUAN UMUM › Bagian Kesatu Tujuan Pasal 2",
          "(1) Contoh bertujuan memberi contoh.\n(2) Contoh sebagaimana dimaksud pada ayat (1) berlaku umum."),
    chunk(5, "BAB I KETENTUAN UMUM › Bagian Kesatu Tujuan Pasal 2", "(3) Contoh tidak berlaku khusus.", part_n=2),
    chunk(6, "BAB II KETENTUAN PENUTUP › Pasal 3", "Peraturan Pemerintah ini mulai berlaku pada tanggal diundangkan."),
]


def doc(work="pp_7_2001", chunks=PP_CHUNKS, jenis="pp"):
    _, nomor, tahun = work.rsplit("_", 2)
    return m.Doc("sha256:abc", work, jenis, nomor, int(tahun),
                 meta={"about": "CONTOH", "effective_date": "3 Mei 2001", "source_title": "PP_No.7_TH_2001",
                       "regulation_type": "PERATURAN PEMERINTAH"},
                 chunks=chunks, quality="clean", status={"status": "none_known"})


def test_labels_go_where_their_text_starts():
    lines = m.rebuild_lines(PP_CHUNKS)
    assert lines[:3] == ["PERATURAN PEMERINTAH REPUBLIK INDONESIA", "NOMOR 7 TAHUN 2001 TENTANG", "CONTOH"]
    assert "Menimbang : a. bahwa contoh perlu diatur;" in lines
    assert "Mengingat : Pasal 5 ayat (2) Undang-Undang Dasar 1945;" in lines


def test_headings_split_and_written_once():
    lines = m.rebuild_lines(PP_CHUNKS)
    i = lines.index("Bagian Kesatu")
    assert lines[i:i + 3] == ["Bagian Kesatu", "Tujuan", "Pasal 2"]
    assert lines.count("Pasal 2") == 1                    # a chunk's second part adds no heading
    assert lines[lines.index("BAB I"):lines.index("BAB I") + 2] == ["BAB I", "KETENTUAN UMUM"]


def test_type_from_the_dataset_fields():
    assert m.jenis_of({"regulation_type": "PERATURANPRESIDEN"}) == "perpres"
    assert m.jenis_of({"regulation_type": "PERATURAN PEMERINTAH", "source_title": "Perpu_4_Tahun_2009"}) == "perppu"
    assert m.jenis_of({"regulation_type": "PERATURAN DAERAH KABUPATEN"}) is None     # regional: not imported
    assert m.work_of({"regulation_type": "PERATURAN PEMERINTAH", "regulation_number": "10", "year": 2000.0}) == ("pp", "10", 2000)
    assert m.work_of({"regulation_type": "PERATURAN PEMERINTAH", "regulation_number": "10/PNPS", "year": 2000.0}) is None


def test_new_record_with_rebuilt_text(tmp_path: Path):
    lines = list(m.import_docs(tmp_path, {"pp_7_2001": doc()}, REV))
    assert lines == ["ok   pp_7_2001: 3 pasal"]
    folder = tmp_path / "peraturan/pp/2001/pp_7_2001"
    rec = yaml.safe_load((folder / "pp_7_2001.yaml").read_text())
    assert rec["title"] == "Peraturan Pemerintah Nomor 7 Tahun 2001 tentang Contoh"
    v = rec["versions"][0]
    assert v["id"] == "pp_7_2001_2001-05-03" and v["source"] == "dataset" and v["rebuilt_from_chunks"]
    assert v["text_revision"] == REV and v["pasal_count"] == 3
    assert rec["id_reg"]["doc_id"] == "sha256:abc"
    assert "Contoh tidak berlaku khusus." in (folder / v["text"]).read_text()


def test_existing_text_is_never_touched(tmp_path: Path):
    folder = tmp_path / "peraturan/pp/2001/pp_7_2001"
    folder.mkdir(parents=True)
    stored = {"id": "pp_7_2001", "versions": [{"id": "pp_7_2001_2001-05-03", "text": "pp_7_2001_2001-05-03.txt"}]}
    (folder / "pp_7_2001.yaml").write_text(yaml.safe_dump(stored))
    assert list(m.import_docs(tmp_path, {"pp_7_2001": doc()}, REV)) == []
    assert yaml.safe_load((folder / "pp_7_2001.yaml").read_text()) == stored


def test_failed_rebuild_leaves_existing_record_unchanged(tmp_path: Path):
    folder = tmp_path / "peraturan/uu/1950/uu_1_1950"
    folder.mkdir(parents=True)
    (folder / "uu_1_1950.yaml").write_text("id: uu_1_1950\nversions: []\n")
    broken = doc("uu_1_1950", [chunk(0, "", "teks tanpa pasal")], jenis="uu")
    lines = list(m.import_docs(tmp_path, {"uu_1_1950": broken}, REV))
    assert lines[0].startswith("--   uu_1_1950: no pasal found")
    assert (folder / "uu_1_1950.yaml").read_text() == "id: uu_1_1950\nversions: []\n"


def test_no_new_records_of_published_types(tmp_path: Path):
    out = list(m.import_docs(tmp_path, {"uu_99_2001": doc("uu_99_2001", jenis="uu")}, REV))
    assert out == ["skip uu_99_2001: published type, not in our records (not created from the dataset)"]
    assert not (tmp_path / "peraturan").exists()


def test_too_few_pasal_are_not_published(tmp_path: Path):
    # the dataset lists Pasal 1-3, but a misread heading hides two of them from the parser
    damaged = PP_CHUNKS[:4]
    damaged += [chunk(4, "BAB I KETENTUAN UMUM › pasal 2", "isi"), chunk(5, "BAB I KETENTUAN UMUM › Pasal 3", "isi")]
    out = list(m.import_docs(tmp_path, {"pp_7_2001": doc(chunks=damaged)}, REV))
    assert "too few pasal" in out[0]
    rec = yaml.safe_load((tmp_path / "peraturan/pp/2001/pp_7_2001/pp_7_2001.yaml").read_text())
    assert rec["versions"] == [] and "dataset lists" in rec["parse_error"]


def test_load_picks_best_document_and_marks_undang_undang_darurat(tmp_path: Path):
    pa = pytest.importorskip("pyarrow")
    pq = pytest.importorskip("pyarrow.parquet")
    rows = []
    for doc_id, nomor, first in [("sha256:a", "6", "UNDANG-UNDANG DARURAT REPUBLIK INDONESIA NOMOR 6 TAHUN 1956"),
                                 ("sha256:b", "7", "UNDANG-UNDANG REPUBLIK INDONESIA NOMOR 7 TAHUN 1956"),
                                 ("sha256:c", "7", "UNDANG-UNDANG REPUBLIK INDONESIA NOMOR 7 TAHUN 1956")]:
        for seq, body in enumerate([first, "Pasal satu."]):
            rows.append({"doc_id": doc_id, "seq": seq, "part_n": 1, "regulation_type": "UNDANG-UNDANG",
                         "enacting_body": "", "regulation_number": nomor, "year": 1956.0, "about": "X",
                         "effective_date": "1 Januari 1956", "heading_path": "", "source_title": f"UU_{nomor}_1956",
                         "source_sha256": "", "chunker": "unit", "chunker_version": "1.2", "profile": "p", "body": body})
    (tmp_path / "bundle/chunks").mkdir(parents=True)
    pq.write_table(pa.Table.from_pylist(rows), tmp_path / "bundle/chunks/part-00000.parquet")
    pq.write_table(pa.Table.from_pylist([{"doc_id": "sha256:a", "verdict": "clean"}, {"doc_id": "sha256:b", "verdict": "degraded"},
                                         {"doc_id": "sha256:c", "verdict": "clean"}]), tmp_path / "bundle/doc_quality.parquet")
    pq.write_table(pa.Table.from_pylist([{"doc_id": "sha256:a", "status": "none_known", "revoked_by": [], "amended_by": []}]),
                   tmp_path / "bundle/doc_status.parquet")
    log: list[str] = []
    docs = m.load(tmp_path, log)
    assert set(docs) == {"uu-drt_6_1956", "uu_7_1956"}
    assert docs["uu_7_1956"].doc_id == "sha256:c"        # clean beats degraded
    assert any("further document" in line for line in log)
