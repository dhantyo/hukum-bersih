"""Page header and footer of scanned pages are cut by position, only in a known layout
(pdf/edges.py). Boxes are those OCR read on UU 100/2024 (Setneg layout, 609.84 x 936.72 pt)."""

import pymupdf
import pytest

from hukum_rapih.pdf import extract
from hukum_rapih.pdf.edges import SETNEG, Row, detect_layout, edge_rows

W, H = 609.84, 936.72


def box(y, text, x0=None, x1=None, h=9):
    """A centred line unless x0/x1 are given."""
    x0 = x0 if x0 is not None else 300 - 3.2 * len(text)
    x1 = x1 if x1 is not None else 300 + 3.2 * len(text)
    return (x0, y, x1, y + h, text)


# page 1: letterhead misread, title, enacting formula, page-turn word, serial
UU_PAGE1 = [
    box(102, "SALINAN", 425, 526, 21),
    box(160, "RESIDEN", 270, 329, 6),
    box(171, "REPUBlK INDONESIA", 233, 365, 8),
    box(227, "UNDANG-UNDANG REPUBLIK INDONESIA", 178, 431),
    box(247, "NOMOR 100 TAHUN 2024"),
    box(370, "PRESIDEN REPUBLIK INDONESIA,", 200, 409),          # enacting formula: law text
    box(410, "Menimbang: a. bahwa Kota Bogor merupakan", 71, 540, 12),
    box(834, "Mengingat . .", 457, 541),
    box(905, "SK No 208513 A", 44, 137),
]
# page 2: header misread ("PR" / "EN"), number, body with the legitimate "PRESIDEN REPUBLIK INDONESIA"
UU_PAGE2 = [
    box(167, "PR", 279, 295, 6), box(168, "EN", 323, 336, 6),
    box(179, "REPUBLIK INDONESIA", 243, 375, 8),
    box(204, "- 2 -", 297, 320, 8),
    box(232, "Mengingat : Pasal 18, Pasal 18A, Pasal 20", 72, 539, 12),
    box(322, "DEWAN PERWAKILAN RAKYAT REPUBLIK INDONESIA", 144, 470, 8),
    box(342, "dan", 295, 318, 8),
    box(362, "PRESIDEN REPUBLIK INDONESIA", 205, 410, 9),
    box(403, "MEMUTUSKAN:"),
    box(842, "Pasal 2 . . .", 475, 540, 9),
    box(905, "SK No 200079 A", 41, 134),
]


def rows(words):
    return extract.row_boxes(words)


def texts(rs, gone):
    return [r.text for i, r in enumerate(rs) if i not in gone]


def test_page_1_letterhead_and_footer_are_cut_but_the_enacting_formula_stays():
    rs = rows(UU_PAGE1)
    edges = edge_rows(rs, W, H, SETNEG, first=True)
    assert texts(rs, edges.gone) == ["UNDANG-UNDANG REPUBLIK INDONESIA", "NOMOR 100 TAHUN 2024",
                                     "PRESIDEN REPUBLIK INDONESIA,", "Menimbang: a. bahwa Kota Bogor merupakan"]
    assert [rs[i].text for i in sorted(edges.gone)] == ["SALINAN", "RESIDEN", "REPUBlK INDONESIA",
                                                         "Mengingat . .", "SK No 208513 A"]


def test_salinan_stamp_beside_the_crest_is_cut_but_not_the_word_in_the_body():
    """Perpres 46/2026, page 1: "SALINAN" boxed top right; the page-turn "Mengingat . . ." with
    spaced dots above "SK No 292234 A"."""
    page = [
        box(88, "SALINAN", 430, 545, 20),
        box(150, "PRESIDEN"), box(165, "REPUBLIK INDONESIA"),
        box(232, "PERATURAN PRESIDEN REPUBLIK INDONESIA", 165, 461),
        box(262, "NOMOR 46 TAHUN 2026"),
        box(440, "PRESIDEN REPUBLIK INDONESIA,", 200, 409),
        box(470, "Menimbang : a. bahwa dalam rangka melaksanakan", 83, 560, 12),
        box(700, "SALINAN", 80, 140),                 # the word in the body: lower down, stays
        box(925, "Mengingat . . .", 455, 545),
        box(960, "SK No 292234 A", 30, 120),
    ]
    rs = rows(page)
    edges = edge_rows(rs, W, 1000, SETNEG, first=True)
    assert [rs[i].text for i in sorted(edges.gone)] == ["SALINAN", "PRESIDEN", "REPUBLIK INDONESIA",
                                                         "Mengingat . . .", "SK No 292234 A"]


def test_page_2_header_down_to_the_number_and_footer_are_cut_by_position():
    rs = rows(UU_PAGE2)
    edges = edge_rows(rs, W, H, SETNEG)
    assert texts(rs, edges.gone) == ["Mengingat : Pasal 18, Pasal 18A, Pasal 20",
                                     "DEWAN PERWAKILAN RAKYAT REPUBLIK INDONESIA", "dan",
                                     "PRESIDEN REPUBLIK INDONESIA", "MEMUTUSKAN:"]


def test_number_read_with_variations():
    for number in ("-2 -", "- 2-", "- 2 -", "— 2 —"):
        rs = rows([box(170, "PRESIDEN"), box(204, number, 297, 320, 8), box(232, "Pasal 2")])
        assert texts(rs, edge_rows(rs, W, H, SETNEG).gone) == ["Pasal 2"]


def test_page_without_markers_loses_nothing():
    body = [box(170, "PRESIDEN"), box(180, "REPUBLIK INDONESIA"), box(204, "2", 297, 320, 8),
            box(232, "Pasal 2", 285, 329), box(842, "c. sebelah . . .", 458, 540), box(905, "SK Nx", 41, 90)]
    rs = rows(body)
    assert edge_rows(rs, W, H, SETNEG).gone == frozenset()
    assert edge_rows(rs, W, H, SETNEG, first=True).gone == frozenset()


def test_page_turn_needs_the_serial_below_it():
    rs = rows([box(232, "Pasal 2"), box(842, "Pasal 3 . . .", 475, 540)])
    assert edge_rows(rs, W, H, SETNEG).gone == frozenset()


def test_body_line_ending_in_dots_above_the_serial_stays():
    rs = rows([box(800, "Hari lahir : ...........................................", 72, 540),
               box(905, "SK No 200079 A", 41, 134)])
    assert texts(rs, edge_rows(rs, W, H, SETNEG).gone) == ["Hari lahir : ..........................................."]


# Layouts differ per kind of regulation: the top of page 1 of these is law text
PERDA_PAGE1 = [
    box(120, "GUBERNUR GORONTALO"),
    box(140, "PERATURAN DAERAH PROVINSI GORONTALO"),
    box(160, "NOMOR 7 TAHUN 2025"),
    box(200, "TENTANG"),
]
PERATURAN_BPK_PAGE1 = [
    box(140, "PERATURAN BADAN PEMERIKSA KEUANGAN"),
    box(155, "REPUBLIK INDONESIA"),
    box(170, "NOMOR 3 TAHUN 2026"),
    box(190, "TENTANG"),
]


@pytest.mark.parametrize("page1", [PERDA_PAGE1, PERATURAN_BPK_PAGE1])
def test_other_layouts_keep_the_top_of_page_1(page1):
    rs = rows(page1)
    assert edge_rows(rs, W, H, None, first=True).gone == frozenset()


def test_layout_is_detected_from_pages_2_plus_only():
    later = [(rows(UU_PAGE2), W, H)] * 3
    assert detect_layout(later) is SETNEG
    assert detect_layout([]) is None
    perda_later = [(rows([box(120, "- 2 -", 297, 320, 8), box(232, "Pasal 2")]), W, H)] * 3
    assert detect_layout(perda_later) is None                      # a number alone is not enough
    assert detect_layout(later + [(rows([box(232, "Pasal 9")]), W, H)] * 4) is None


# --- through page_lines, with a fake OCR engine ---------------------------------------------

def scan_pdf(path, pages):
    doc = pymupdf.open()
    src = pymupdf.open()
    src.new_page(width=W, height=H).insert_text((72, 100), "x", fontsize=14)
    pix = src[0].get_pixmap(dpi=72)
    for _ in pages:
        page = doc.new_page(width=W, height=H)
        page.insert_image(page.rect, pixmap=pix)
    doc.save(path)
    return path


@pytest.fixture
def fake_ocr(monkeypatch, tmp_path):
    pages = {}

    def chunk(pdf, nums, engine="tesseract"):
        return [(n, pages[n]) for n in nums]

    monkeypatch.setattr(extract, "_ocr_chunk", chunk)
    monkeypatch.setattr(extract, "ocr_pages", lambda pdf, nums, engine="tesseract": dict(chunk(str(pdf), nums)))
    monkeypatch.setenv("HUKUM_RAPIH_OCR", "tesseract")
    monkeypatch.setenv("HUKUM_RAPIH_OCR_CACHE", "off")
    return pages


def test_uu_100_2024_header_and_footer_never_reach_the_text(tmp_path, fake_ocr):
    fake_ocr.update({0: UU_PAGE1, 1: UU_PAGE2, 2: UU_PAGE2})
    stats = {}
    pages = extract.page_lines(scan_pdf(tmp_path / "uu.pdf", fake_ocr), stats)
    text = extract.clean_lines(pages, stats)
    assert text[:2] == ["UNDANG-UNDANG REPUBLIK INDONESIA", "NOMOR 100 TAHUN 2024"]
    assert "RESIDEN REPUBlK" not in " ".join(text) and "PR EN" not in text
    assert not any(ln.startswith("Mengingat .") for ln in text)
    # the law's own words stay, with the short "dan" above the enacting formula
    assert text.count("dan") == 2 and text.count("PRESIDEN REPUBLIK INDONESIA") == 2
    assert text.count("PRESIDEN REPUBLIK INDONESIA,") == 1
    assert len(stats["edge_lines"]) == 5 + 2 * 5 and stats["edge_head"] == [0, 1, 2]


@pytest.mark.parametrize("page1", [PERDA_PAGE1, PERATURAN_BPK_PAGE1])
def test_other_regulations_drop_nothing_by_position(tmp_path, fake_ocr, page1):
    later = [box(170, "PRESIDEN"), box(204, "- 2 -", 297, 320, 8), box(232, "Pasal 2", 285, 329)]
    fake_ocr.update({0: page1, 1: later, 2: later})
    stats = {}
    pages = extract.page_lines(scan_pdf(tmp_path / "other.pdf", fake_ocr), stats)
    assert pages[0] == [b[4] for b in page1]
    assert stats["edge_lines"] == [] and stats["edge_head"] == []


def test_typed_pages_are_unchanged(tmp_path):
    doc = pymupdf.open()
    page = doc.new_page(width=W, height=H)
    page.insert_text((300, 80), "- 2 -")
    page.insert_text((72, 200), "Pasal 2")
    page.insert_text((44, 905), "SK No 208513 A")
    doc.save(tmp_path / "typed.pdf")
    stats = {}
    assert extract.page_lines(tmp_path / "typed.pdf", stats) == [["- 2 -", "Pasal 2", "SK No 208513 A"]]
    assert stats["edge_lines"] == []


def test_row_is_a_namedtuple_of_its_box():
    assert Row(1, 2, 3, 4, "x").text == "x"
