import pytest

from hukum_bersih.naming import archive_item, default_title, tanggal, validate_id


@pytest.mark.parametrize(
    "good",
    [
        "uu_11_2008",
        "uu_11_2008_2008-04-21",
        "perppu_2_2022",
        "uu-drt_7_1955",
        "ruu_perampasan-aset_2026-11-19_draft-final",
        "ruu_perampasan-aset_2023-05_draft_pemerintah",
        "ruu_perampasan-aset_2026-11-09_dim_2",
        "ruu_perampasan-aset_2008_draft_ppatk",
    ],
)
def test_valid_ids(good):
    assert validate_id(good) == good


@pytest.mark.parametrize(
    "bad",
    [
        "UU_11_2008",
        "uu-11-2008",  # parts must be joined by _, not -
        "uu__11_2008",
        "_uu_11_2008",
        "uu_11_2008_",
        "uu 11 2008",
        "",
        "a" * 101,
        "ruu_perampasan-aset_2026-11-19_draft-ruu-final",  # unknown type
        "ruu_perampasan-aset_draft-final",  # no date
    ],
)
def test_invalid_ids(bad):
    with pytest.raises(ValueError):
        validate_id(bad)


def test_archive_item():
    assert archive_item("uu_11_2008_2008-04-21") == "uu_11_2008"
    assert archive_item("uu_11_2008") == "uu_11_2008"
    assert archive_item("ruu_perampasan-aset_2026-11-19_draft-final") == (
        "ruu_perampasan-aset_2026-11-19_draft-final"
    )


def test_tanggal():
    assert tanggal("2026-11-19") == "19 November 2026"
    assert tanggal("2023-05") == "Mei 2023"
    assert tanggal("2008") == "2008"
    assert tanggal("2024-01-02") == "2 Januari 2024"


def test_default_title_regulation(tmp_path):
    assert default_title("uu_11_2008_2008-04-21", tmp_path) == "Undang-Undang Nomor 11 Tahun 2008"
    assert default_title("perppu_2_2022", tmp_path) == (
        "Peraturan Pemerintah Pengganti Undang-Undang Nomor 2 Tahun 2022"
    )


def test_default_title_ruu_uses_tracker(tmp_path):
    d = tmp_path / "ruu" / "contoh"
    d.mkdir(parents=True)
    (d / "ruu.yaml").write_text(
        "title: RUU tentang Contoh Baru\n"
        "documents:\n"
        "  - id: ruu_contoh_2023-05_draft_pemerintah\n"
        "    ruu_title: RUU tentang Contoh Lama\n"
    )
    assert default_title("ruu_contoh_2023-05_draft_pemerintah", tmp_path) == (
        "Draf RUU (Pemerintah) – RUU tentang Contoh Lama (Mei 2023)"
    )
    assert default_title("ruu_contoh_2026-11-19_draft-final", tmp_path) == (
        "Draf RUU Final – RUU tentang Contoh Baru (19 November 2026)"
    )
    assert default_title("ruu_contoh_2026-11-09_dim_2", tmp_path) == (
        "Daftar Inventaris Masalah, bagian 2 – RUU tentang Contoh Baru (9 November 2026)"
    )
