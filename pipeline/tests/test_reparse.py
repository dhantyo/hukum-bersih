"""A failed download or parse during a re-conversion must keep the stored text."""
import yaml
from recfactory import make_record, make_version

from hukum_rapih.sources import peraturan_go_id as src


class Down:
    def get(self, path):
        raise ConnectionError("peraturan.go.id did not answer")


def _record(tmp_path):
    folder = tmp_path / "peraturan" / "uu" / "2009" / "uu_4_2009"
    folder.mkdir(parents=True)
    (folder / "uu_4_2009_2009-01-12.txt").write_text("BODY\n  ART 1 -\n    Teks.\n")
    rec = make_record("uu_4_2009", tanggal_penetapan="2009-01-12",
                      source_pdf_url="https://peraturan.go.id/files/UU0042009.pdf",
                      versions=[make_version("uu_4_2009", parser_version=1)])
    (folder / "uu_4_2009.yaml").write_text(yaml.safe_dump(rec))
    return folder


def test_download_failure_keeps_text(tmp_path):
    folder = _record(tmp_path)
    lines = list(src.reparse(Down(), "uu", tmp_path))
    assert lines[0].startswith("FAIL uu_4_2009")
    assert (folder / "uu_4_2009_2009-01-12.txt").exists()
    rec = yaml.safe_load((folder / "uu_4_2009.yaml").read_text())
    assert rec["versions"][0]["text"] == "uu_4_2009_2009-01-12.txt"


def _text(pasal=2, penjelasan_words=300, after_tln="", tln="TAMBAHAN LEMBARAN NEGARA REPUBLIK INDONESIA NOMOR 6805"):
    """A Bluebell text: a body of ``pasal`` pasal, a Penjelasan with its TLN line, then ``after_tln``."""
    body = "BODY\n" + "".join(f"  ART {n} -\n    {'kata ' * (5000 if n == 1 else 1)}\n" for n in range(1, pasal + 1))
    penjelasan = f"ATTACHMENT Penjelasan\n  PART II - PASAL DEMI PASAL\n    ART 1 -\n      {'jelas ' * penjelasan_words}\n"
    return body + penjelasan + (f"  {tln}\n" if tln else "") + after_tln


def _stored(tmp_path, text):
    path = tmp_path / "stored.txt"
    path.write_text(text)
    return path


def test_a_stale_pasal_count_in_the_record_does_not_refuse_a_good_text(tmp_path):
    # uu_17_2016: the record said 3 pasal (an old parser counted a stray block), the text has 2
    import pymupdf

    folder = tmp_path / "uu_17_2016"
    folder.mkdir()
    (folder / "uu_17_2016_2016-11-09.txt").write_text(
        "BODY\n  ART 1 -\n    satu satu satu\n  ART 2 -\n    dua dua dua\n")
    rec = make_record("uu_17_2016", tanggal_penetapan="2016-11-09",
                      versions=[make_version("uu_17_2016", "2016-11-09", pasal_count=3)])
    pdf = pymupdf.open()
    page = pdf.new_page()
    for k, line in enumerate(["Menimbang : a. bahwa x;", "Pasal 1", "satu " * 8, "Pasal 2", "dua " * 8]):
        page.insert_text((72, 72 + 20 * k), line)
    pdf.save(tmp_path / "p.pdf")
    note = src.convert_pdf(tmp_path / "p.pdf", rec, folder, source="peraturan.bpk.go.id")
    assert note == "2 pasal" and "reparse_error" not in rec
    assert rec["versions"][0]["pasal_count"] == 2


def test_fewer_pasal_in_the_body_refuse_the_new_text(tmp_path):
    reason = src._poorer_than_stored(_stored(tmp_path, _text(pasal=5)), _text(pasal=4), amending=False)
    assert "4 pasal, stored text 5" in reason


def test_pasal_of_the_penjelasan_and_lampiran_do_not_hide_a_lost_body_pasal(tmp_path):
    stored = _text(pasal=5, after_tln="ATTACHMENT Lampiran\n  PART - LAMPIRAN\n    ART 9 -\n      x\n")
    assert "2 pasal, stored text 5" in src._poorer_than_stored(_stored(tmp_path, stored), _text(pasal=2), False)


def test_an_amending_law_is_not_compared_by_pasal(tmp_path):
    assert src._poorer_than_stored(_stored(tmp_path, _text(pasal=31)), _text(pasal=2), amending=True) is None


def test_ocr_noise_after_the_penjelasan_tln_line_is_not_penjelasan(tmp_path):
    # uu_16_2022: a map's noise after the Penjelasan's own TLN line counted as Penjelasan words
    noisy = _text(after_tln="peta " * 3000)
    assert src._poorer_than_stored(_stored(tmp_path, noisy), _text(after_tln="peta " * 2800), False) is None
    lost_penjelasan = _text(penjelasan_words=100, after_tln="peta " * 3000)
    assert "Penjelasan has" in src._poorer_than_stored(_stored(tmp_path, noisy), lost_penjelasan, False)


def test_the_tln_line_is_found_through_ocr_variants(tmp_path):
    noisy = _text(tln="TAMBAHAN LEMBARAN-NEGARA REPUBLIK INDONESIA NOMOR 6805", after_tln="peta " * 3000)
    lost_penjelasan = _text(penjelasan_words=100, tln="TAMBAHAN  LEMBARAN NEGARA REPUBLIK", after_tln="peta " * 3000)
    assert "Penjelasan has" in src._poorer_than_stored(_stored(tmp_path, noisy), lost_penjelasan, False)


def test_without_a_tln_line_the_penjelasan_runs_to_the_end(tmp_path):
    stored = _text(tln="", after_tln="jelas " * 300)
    assert "Penjelasan has" in src._poorer_than_stored(_stored(tmp_path, stored), _text(tln=""), False)


def test_quoted_tln_text_inside_the_penjelasan_does_not_end_it(tmp_path):
    quoted = _text(penjelasan_words=300, tln="").replace(
        "ATTACHMENT Penjelasan\n", "ATTACHMENT Penjelasan\n  Tambahan Lembaran Negara Republik Indonesia Nomor 5898\n")
    assert "Penjelasan has" in src._poorer_than_stored(_stored(tmp_path, quoted), _text(penjelasan_words=100, tln=""), False)


LAW = ["Menimbang : a. bahwa x;", "Pasal 1", "satu " * 8, "Pasal 2", "dua " * 8]
SIGNED = ["Disahkan di Jakarta", "pada tanggal 1 Mei 2020"]
BODY = "BODY\n  ART 1 -\n    " + "satu " * 8 + "\n  ART 2 -\n    " + "dua " * 8 + "\n"
STORED = "uu_1_2020_2020-05-01.txt"


def _pdf(path, lines):
    import pymupdf

    pdf = pymupdf.open()
    page = pdf.new_page()
    for k, line in enumerate(lines):
        page.insert_text((72, 72 + 20 * k), line)
    pdf.save(path)
    return path


def _law_with_text(tmp_path, stored):
    folder = tmp_path / "uu_1_2020"
    folder.mkdir()
    (folder / STORED).write_text(stored)
    rec = make_record("uu_1_2020", tanggal_penetapan="2020-05-01",
                      versions=[make_version("uu_1_2020", "2020-05-01", pasal_count=2)])
    return folder, rec


def test_a_new_text_failing_a_check_the_stored_text_passes_is_refused(tmp_path):
    from hukum_rapih.pdf.structure import PARSER_VERSION

    stored = BODY + "CONCLUSIONS\n  Disahkan di Jakarta\n\n  pada tanggal 1 Mei 2020\n"
    folder, rec = _law_with_text(tmp_path, stored)
    note = src.convert_pdf(_pdf(tmp_path / "p.pdf", LAW), rec, folder, source="peraturan.bpk.go.id")
    assert note == "kept old text (check no_closing_date worse)"
    assert rec["reparse_error"] == f"v{PARSER_VERSION}: check no_closing_date worse"
    assert (folder / STORED).read_text() == stored


def test_a_new_text_failing_only_checks_the_stored_text_fails_replaces_it(tmp_path):
    from hukum_rapih.records import load_record, save_record

    folder, rec = _law_with_text(tmp_path, BODY)          # no closing date, no preamble
    note = src.convert_pdf(_pdf(tmp_path / "p.pdf", LAW + SIGNED), rec, folder, source="peraturan.bpk.go.id")
    assert note == "2 pasal" and "reparse_error" not in rec
    assert (folder / STORED).read_text() != BODY
    save_record(folder / "uu_1_2020.yaml", rec)
    checks = load_record(folder / "uu_1_2020.yaml")["versions"][0]["checks"]
    assert checks["word_coverage"] > 0.9 and "word_coverage" not in [f["name"] for f in checks["failed"]]
