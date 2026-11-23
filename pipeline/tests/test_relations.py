from hukum_bersih.relations import changes_in_text, from_title


def test_amendment_titles():
    assert from_title("PERUBAHAN KEDUA ATAS UNDANG-UNDANG NOMOR 11 TAHUN 2008 TENTANG INFORMASI "
                      "DAN TRANSAKSI ELEKTRONIK")["amends"] == [{"id": "uu_11_2008", "order": 2}]
    assert from_title("Perubahan atas Undang-Undang Nomor 11 Tahun 2008 tentang Informasi dan "
                      "Transaksi Elektronik")["amends"] == [{"id": "uu_11_2008"}]
    assert from_title("PERUBAHAN DAN PENYEMPURNAAN UNDANG-UNDANG NOMOR 3 TAHUN 1967 TENTANG DEWAN "
                      "PERTIMBANGAN AGUNG")["amends"] == [{"id": "uu_3_1967"}]
    old = from_title("PEMBENTUKAN KOTAPRAJA SABANG DENGAN MENGUBAH UNDANG-UNDANG NOMOR 7 DRT TAHUN "
                     "1956, TENTANG PEMBENTUKAN DAERAH OTONOM")
    assert old["amends"] == [{"id": "uu-drt_7_1956"}]
    assert from_title("PERUBAHAN BATAS WILAYAH KOTAPRAJA SURABAYA DENGAN MENGUBAH UNDANG-UNDANG NO. "
                      "12 TAHUN 1950, TENTANG PEMBENTUKAN DAERAH")["amends"] == [{"id": "uu_12_1950"}]


def test_not_an_amendment():
    r = from_title("PEMBENTUKAN PENGADILAN TINGGI PONTIANAK DAN PERUBAHAN WILAYAH HUKUM "
                   "PENGADILAN TINGGI JAKARTA")
    assert r == {"amends": [], "revokes": [], "enacts": []}


def test_enact_and_revoke():
    r = from_title("PENETAPAN PERATURAN PEMERINTAH PENGGANTI UNDANG-UNDANG NOMOR 2 TAHUN 2022 "
                   "TENTANG CIPTA KERJA MENJADI UNDANG-UNDANG")
    assert r["enacts"] == ["perppu_2_2022"] and r["amends"] == []
    r = from_title("PENETAPAN PERATURAN PEMERINTAH PENGGANTI UNDANG-UNDANG NOMOR 1 TAHUN 2022 "
                   "TENTANG PERUBAHAN ATAS UNDANG-UNDANG NOMOR 7 TAHUN 2017 TENTANG PEMILIHAN "
                   "UMUM MENJADI UNDANG-UNDANG")
    assert r["enacts"] == ["perppu_1_2022"] and r["amends"] == [{"id": "uu_7_2017"}]
    assert from_title("PENCABUTAN UNDANG-UNDANG NOMOR 78 TAHUN 1958 TENTANG PENANAMAN MODAL "
                      "ASING")["revokes"] == ["uu_78_1958"]
    r = from_title('PENETAPAN "UNDANG-UNDANG DARURAT NO. 40 TAHUN 1950 TENTANG SURAT PERJALANAN '
                   'REPUBLIK INDONESIA", SEBAGAI UNDANG-UNDANG')
    assert r["enacts"] == ["uu-drt_40_1950"]


def test_changes_in_text():
    text = """BODY
  ART I -
    Beberapa ketentuan diubah sebagai berikut:
    POINT 1.
      Di antara angka 6 dan angka 7 Pasal 1 disisipkan 1 (satu) angka, yakni angka 6a
    POINT 2.
      Ketentuan ayat (3) dan ayat (4) Pasal 31 diubah sehingga berbunyi sebagai berikut:
    POINT 3.
      Di antara ayat (2) dan ayat (3) Pasal 40 disisipkan 2 (dua) ayat, yakni ayat (2a)
    POINT 4.
      Ketentuan Pasal 45 diubah sehingga berbunyi sebagai berikut:
    POINT 5.
      Di antara Pasal 45 dan Pasal 46 disisipkan 2 (dua) pasal, yakni Pasal 45A dan Pasal 45B sehingga berbunyi:
    POINT 6.
      Pasal 9 dihapus.
ATTACHMENT Penjelasan
  Ketentuan Pasal 99 diubah
"""
    assert changes_in_text(text) == {
        "diubah": ["1", "31", "40", "45"], "disisipkan": ["45A", "45B"], "dihapus": ["9"]}


def test_ocr_misreads_in_numbers_only():
    text = ("BODY Ketentuan ayat (6) Pasal 4O diubah. Di antara Pasal 16 dan Pasal 17 disisipkan "
            "2 (dua) pasal, yakni Pasal 16A dan Pasal 168 sehingga berbunyi: Di antara Pasal 27 dan "
            "Pasal 28 disisipkan 2 (dua) pasal, yakni Pasil 27A dan Pasal 27B sehingga berbunyi:")
    assert changes_in_text(text) == {"diubah": ["40"], "disisipkan": ["16A", "16B", "27A", "27B"]}


def test_revoked_per_source_status(tmp_path):
    import yaml

    from hukum_bersih.relations import build

    for rid, status in [("uu_1_1995", "Tidak Berlaku Dicabut Oleh : Undang-Undang Nomor 40 Tahun 2007 Tentang Perseroan Terbatas"),
                        ("uu_40_2007", "berlaku")]:
        y = rid.split("_")[2]
        d = tmp_path / "peraturan" / "uu" / y / rid
        d.mkdir(parents=True)
        (d / f"{rid}.yaml").write_text(yaml.safe_dump({"id": rid, "tentang": "PERSEROAN TERBATAS", "status": status, "versions": []}))
    build(tmp_path)
    old = yaml.safe_load((tmp_path / "peraturan/uu/1995/uu_1_1995/uu_1_1995.yaml").read_text())
    new = yaml.safe_load((tmp_path / "peraturan/uu/2007/uu_40_2007/uu_40_2007.yaml").read_text())
    assert old["relationships"]["revoked_by"] == ["uu_40_2007"]
    assert new["relationships"]["revokes"] == ["uu_1_1995"]


def test_only_laws_amend_laws(tmp_path):
    """A PP's title names the law it implements; that is no amendment (PP 1/2012)."""
    import yaml

    from hukum_bersih.relations import build

    for jenis, rid, tentang in [
        ("uu", "uu_8_1983", "PAJAK PERTAMBAHAN NILAI"),
        ("pp", "pp_1_2012", ("PELAKSANAAN UNDANG-UNDANG NOMOR 8 TAHUN 1983 TENTANG PAJAK PERTAMBAHAN NILAI "
                             "SEBAGAIMANA TELAH BEBERAPA KALI DIUBAH TERAKHIR DENGAN UNDANG-UNDANG NOMOR 42 TAHUN 2009")),
        ("perppu", "perppu_1_1984", "PERUBAHAN ATAS UNDANG-UNDANG NOMOR 8 TAHUN 1983 TENTANG PAJAK PERTAMBAHAN NILAI"),
    ]:
        d = tmp_path / "peraturan" / jenis / rid.split("_")[2] / rid
        d.mkdir(parents=True)
        (d / f"{rid}.yaml").write_text(yaml.safe_dump({"id": rid, "tentang": tentang, "versions": []}))
    build(tmp_path)
    uu = yaml.safe_load((tmp_path / "peraturan/uu/1983/uu_8_1983/uu_8_1983.yaml").read_text())
    assert uu["relationships"]["amended_by"] == ["perppu_1_1984"]
