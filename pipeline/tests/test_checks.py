"""The self-checks on a law's text (checks.py, decision 0026): each passes on a sound text and
fails on one with the fault it looks for."""
import pytest

from hukum_rapih.checks import OCR_UNKNOWN_MAX, WORD_COVERAGE_MIN, run_checks, words

REC = {"akn": "/akn/id/act/uu/2020/1"}
CLOSING = "CONCLUSIONS\n  Disahkan di Jakarta\n\n  pada tanggal 1 Mei 2020\n"
SOUND_BODY = (
    "  ART 1 -\n"
    "    PARA (1)\n      Setiap orang wajib:\n\n"
    "      POINT a.\n        membayar pajak;\n\n"
    "      POINT b.\n        melapor.\n\n"
    "    PARA (2)\n      Cukup.\n\n"
    "  ART 2 -\n    Undang-Undang ini mulai berlaku pada tanggal diundangkan.\n\n"
)
# the same law as printed in its PDF
PRINTED = ("Pasal 1 (1) Setiap orang wajib: a. membayar pajak; b. melapor. (2) Cukup. Pasal 2 "
           "Undang-Undang ini mulai berlaku pada tanggal diundangkan. "
           "Disahkan di Jakarta pada tanggal 1 Mei 2020")


def law(body: str = SOUND_BODY, after: str = "") -> str:
    return "BODY\n" + body + CLOSING + after


def failed(text: str, **kw) -> dict[str, str]:
    return run_checks(REC, text, **kw).failed


def test_a_sound_text_fails_no_check():
    checks = run_checks(REC, law(), words(PRINTED), ocr_unknown=0)
    assert checks.failed == {}
    assert checks.word_coverage == 1.0 and checks.ocr_unknown_rate == 0.0


def test_markup_left_in_the_text_is_invalid_akoma_ntoso():
    leaked = "  ART 1 -\n    Teks:\n\n      POINT a.\n        x\n"
    assert list(failed(law(leaked))) == ["invalid_akn"]


@pytest.mark.parametrize(("body", "detail"), [
    ("  ART 1 -\n    satu.\n\n  ART 3 -\n    tiga.\n", "1->3"),
    ("  ART 2 -\n    dua.\n", "starts 2"),
    ("  PARA (1)\n    tanpa pasal.\n", "no pasal"),
])
def test_pasal_numbered_with_a_gap(body, detail):
    assert failed(law(body))["pasal_gap"] == detail


def test_a_pasal_heading_glued_into_the_text_is_missed():
    body = SOUND_BODY.replace("Cukup.", "Cukup. Pasal 3 Setiap orang dilarang merokok.")
    assert failed(law(body))["missed_heading"] == "body 1"


def test_a_missed_heading_in_the_penjelasan_is_found():
    penjelasan = ("ATTACHMENT Penjelasan\n  PART II - PASAL DEMI PASAL\n    ART 1 -\n"
                  "      Cukup jelas. Pasal 2 Cukup jelas.\n")
    assert failed(law(after=penjelasan))["missed_heading"] == "penjelasan 1"


def test_a_reference_to_another_law_is_no_missed_heading():
    body = SOUND_BODY.replace("Cukup.", "Sebagaimana berikut: Pasal 33 Undang-Undang Dasar 1945.")
    assert "missed_heading" not in failed(law(body))


def test_page_furniture_in_the_text():
    body = SOUND_BODY.replace("Cukup.", "Cukup. Diunduh dari peraturan.go.id - 2 -")
    assert failed(law(body))["page_furniture"] == "page no. 1, watermark 1"


def test_a_closing_without_a_date_of_signing():
    assert failed("BODY\n" + SOUND_BODY)["no_closing_date"] == "no date of signing"


@pytest.mark.parametrize(("ayat", "detail"), [
    (["(1)", "(3)"], "Pasal 1 (1)->(3)"),
    (["(2)", "(3)"], "Pasal 1 starts (2)"),
])
def test_ayat_out_of_order(ayat, detail):
    body = "  ART 1 -\n" + "".join(f"    PARA {a}\n      Teks.\n\n" for a in ayat)
    assert failed(law(body))["ayat_order"] == detail


def test_an_inserted_ayat_keeps_the_order():
    body = "  ART 1 -\n" + "".join(f"    PARA {a}\n      Teks.\n\n" for a in ["(1)", "(1a)", "(2)"])
    assert "ayat_order" not in failed(law(body))


def items(*labels: str, depth: int = 6) -> str:
    return "".join(f"{' ' * depth}POINT {label}\n{' ' * (depth + 2)}teks;\n\n" for label in labels)


@pytest.mark.parametrize(("labels", "detail"), [
    (["a.", "c."], "Pasal 1 a.->c."),
    (["b.", "c."], "Pasal 1 starts b."),
])
def test_list_letters_out_of_order(labels, detail):
    body = "  ART 1 -\n    PARA (1)\n      Meliputi:\n\n" + items(*labels)
    assert failed(law(body))["list_order"] == detail


@pytest.mark.parametrize("body", [
    # a nested numbered list between a. and b.
    "  ART 1 -\n    Meliputi:\n\n" + items("a.", depth=4) + items("1.", "2.", depth=6) + items("b.", depth=4),
    # a second list in the same ayat, after text
    "  ART 1 -\n    Meliputi:\n\n" + items("a.", "b.", depth=4) + "    Dan:\n\n" + items("a.", depth=4),
    # text between two items does not end the list
    "  ART 1 -\n    Meliputi:\n\n" + items("a.", depth=4) + "    sambungan.\n\n" + items("b.", depth=4),
    # Roman numerals
    "  ART 1 -\n    Meliputi:\n\n" + items("i.", "ii.", "iii.", depth=4),
])
def test_lists_in_order(body):
    assert "list_order" not in failed(law(body))


def test_an_amending_law_is_not_checked_for_the_order_it_quotes():
    body = "  ART I -\n    Diubah:\n\n" + items("c.", depth=4) + "    PARA (3)\n      Teks.\n\n"
    assert not {"ayat_order", "list_order", "missed_heading"} & set(failed(law(body)))


def words_text(n: int) -> str:
    """A text of ``n`` words: three of markup, the rest "kata"."""
    return "BODY\n  ART 1 -\n    " + "kata " * (n - 3) + "\n"


AT_MIN = round(WORD_COVERAGE_MIN * 1000)
AT_MAX = round(OCR_UNKNOWN_MAX * 1000)


@pytest.mark.parametrize(("found", "fails"), [(AT_MIN, False), (AT_MIN - 1, True)])
def test_word_coverage_fails_below_its_minimum(found, fails):
    checks = run_checks(REC, words_text(found + 3), words("kata " * 1000))
    assert checks.word_coverage == found / 1000
    assert ("word_coverage" in checks.failed) is fails


def test_word_coverage_is_not_run_without_the_pdf():
    checks = run_checks(REC, law())
    assert checks.word_coverage is None and "word_coverage" not in set(checks.failed) | checks.passed


@pytest.mark.parametrize(("unknown", "fails"), [(AT_MAX, False), (AT_MAX + 1, True)])
def test_ocr_unknown_fails_above_its_maximum(unknown, fails):
    checks = run_checks(REC, words_text(1000), ocr_unknown=unknown)
    assert checks.ocr_unknown_rate == unknown / 1000
    assert ("ocr_unknown" in checks.failed) is fails


def test_a_check_the_stored_text_could_not_run_is_no_worse():
    # a text OCR'd before the spell fix (parser < 15) has no unknown-word count to compare with
    stored = run_checks(REC, law())
    new = run_checks(REC, law(), ocr_unknown=30)
    assert new.worse_than(stored) == []
    assert new.worse_than(run_checks(REC, law(), ocr_unknown=0)) == ["ocr_unknown"]
