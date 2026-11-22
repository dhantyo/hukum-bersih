"""Closing fields from the closing lines as printed, four eras of the BPK sample."""

from hukum_bersih.closing import parse

UU_30_1947 = ["Ditetapkan di Yogyakarta", "pada tanggal 30 Agustus 1947.", "PRESIDEN REPUBLIK INDONESIA,",
              "SOEKARNO.", "Menteri Keuangan,", "A.A. MARAMIS.", "Diumumkan pada tanggal 30 Agustus 1947.",
              "Sekretaris Negara,", "A.G. PRINGGODIGDO."]
UU_25_1956 = ["Agar supaya setiap orang dapat mengetahuinya, memerintahkan pengundangan undang-undang ini.",
              "Disahkan di Jakarta", "pada tanggal 29 Nopember 1956.", "Presiden Republik Indonesia.", "ttd.",
              "SOEKARNO.", "Menteri Dalam Negeri,", "ttd.", "SUNARJO", "Diundangkan", "pada tanggal 7 Desember 1956.",
              "Menteri Kehakiman,", "ttd.", "MULJATNO.", "LEMBARAN NEGARA NOMOR 65 TAHUN 1956"]
UU_4_2009 = [("Agar setiap orang mengetahuinya, memerintahkan pengundangan Undang-Undang ini dengan penempatannya "
             "dalam Lembaran Negara Republik Indonesia."), "Disahkan di Jakarta", "pada tanggal 12 Januari 2009",
             "PRESIDEN REPUBLIK INDONESIA,", "ttd.", "DR. H. SUSILO BAMBANG YUDHOYONO", "Diundangkan di Jakarta",
             "pada tanggal 12 Januari 2009", "MENTERI HUKUM DAN HAK ASASI MANUSIA", "REPUBLIK INDONESIA,", "ttd.",
             "ANDI MATTALATTA", "LEMBARAN NEGARA REPUBLIK INDONESIA TAHUN 2009 NOMOR 4"]


def test_modern_closing():
    c = parse(UU_4_2009)
    assert c["order"].startswith("Agar setiap orang")
    assert c["signed"] == {"place": "Jakarta", "date": "12 Januari 2009", "office": "PRESIDEN REPUBLIK INDONESIA",
                           "name": "DR. H. SUSILO BAMBANG YUDHOYONO"}
    assert c["promulgated"] == {"place": "Jakarta", "date": "12 Januari 2009",
                                "office": "MENTERI HUKUM DAN HAK ASASI MANUSIA REPUBLIK INDONESIA",
                                "name": "ANDI MATTALATTA"}
    assert c["lembaran_negara"] == {"tahun": 2009, "nomor": 4}


def test_1956_closing_with_cosigner():
    c = parse(UU_25_1956)
    assert c["signed"]["office"] == "Presiden Republik Indonesia" and c["signed"]["name"] == "SOEKARNO"
    assert c["signed"]["cosigners"] == [{"office": "Menteri Dalam Negeri", "name": "SUNARJO"}]
    assert c["promulgated"] == {"date": "7 Desember 1956", "office": "Menteri Kehakiman", "name": "MULJATNO"}
    assert c["lembaran_negara"] == {"tahun": 1956, "nomor": 65}


def test_1947_closing():
    c = parse(UU_30_1947)
    assert c["signed"]["place"] == "Yogyakarta" and c["signed"]["date"] == "30 Agustus 1947"
    assert c["signed"]["name"] == "SOEKARNO"
    assert c["signed"]["cosigners"] == [{"office": "Menteri Keuangan", "name": "A.A. MARAMIS"}]
    assert c["promulgated"] == {"date": "30 Agustus 1947", "office": "Sekretaris Negara", "name": "A.G. PRINGGODIGDO"}
    assert "order" not in c and "lembaran_negara" not in c          # not printed: not invented


def test_nothing_invented_from_nothing():
    assert parse([]) == {}


def test_offices_without_comma_and_a_misprinted_disahkan():          # UU 19/1997, UU 31/1999
    c = parse(["Disahkan di Jakarta", "pada tanggal 23 Mei 1997", "PRESIDEN REPUBLIK INDONESIA", "ttd.", "SOEHARTO",
               "Diundangkan di Jakarta", "pada tanggal tanggal 23 Mei 1997", "MENTERI NEGARA SEKRETARIAT NEGARA",
               "REPUBLIK INDONESIA", "ttd.", "SOEHARTO"])
    assert c["signed"]["office"] == "PRESIDEN REPUBLIK INDONESIA" and c["signed"]["name"] == "SOEHARTO"
    assert c["promulgated"]["office"] == "MENTERI NEGARA SEKRETARIAT NEGARA REPUBLIK INDONESIA"
    assert c["promulgated"]["date"] == "tanggal 23 Mei 1997"                  # as printed
    c = parse(["Disahkan di Jakarta", "pada tanggal 16 Agustus 1999", "PRESIDEN REPUBLIK INDONESIA", "ttd.",
               "BACHARUDDIN JUSUF HABIBIE", "Disahkan di Jakarta", "pada tanggal 16 Agustus 1999",
               "MENTERI NEGARA SEKRETARIAT NEGARA", "REPUBLIK INDONESIA,", "ttd.", "MULADI"])
    assert c["promulgated"]["name"] == "MULADI" and "Disahkan" in c["promulgated"]["note"]


def test_line_breaks_and_blank_place():                                # UU 11/2008, UU 14/2008
    c = parse(["Disahkan di Jakarta pada", "tanggal 21 April 2008", "PRESIDEN REPUBLIK INDONESIA,", "ttd.", "X",
               "Diundangkan di Jakarta pada", "tanggal 21 April 2008", "MENTERI,", "Y"])
    assert c["signed"]["place"] == "Jakarta" and c["signed"]["date"] == "21 April 2008"
    assert c["promulgated"]["place"] == "Jakarta" and c["promulgated"]["date"] == "21 April 2008"
    c = parse(["Disahkan di", "pada tanggal 30 April 2008", "PRESIDEN REPUBLIK INDONESIA,", "ttd.", "X"])
    assert "place" not in c["signed"] and c["signed"]["date"] == "30 April 2008"
