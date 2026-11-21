import pytest

from hukum_bersih.uploads import id_from_filename


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
    from hukum_bersih.sources.peraturan_go_id import tanggal_iso

    assert tanggal_iso("01 Januari 1970") is None       # peraturan.go.id's empty date
    assert tanggal_iso("12 Januari 2009") == "2009-01-12"
