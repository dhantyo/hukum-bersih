"""Which stored texts the importer redoes after a parser or OCR change (`text_current`)."""


def test_a_new_parser_redoes_only_flagged_or_old_texts():
    from hukum_rapih.pdf.structure import PARSER_REDO_BELOW, PARSER_VERSION
    from hukum_rapih.sources.peraturan_bpk import SOURCE, text_current

    def rec(pv, **flags):
        return {"versions": [{"text": "t.txt", "parser_version": pv, "pdf_source": SOURCE}], **flags}

    assert PARSER_REDO_BELOW < PARSER_VERSION
    assert text_current(rec(PARSER_REDO_BELOW))                      # good older text: kept
    assert not text_current(rec(PARSER_REDO_BELOW - 1))              # too old: redone
    assert not text_current(rec(PARSER_REDO_BELOW, reparse_error=f"v{PARSER_VERSION - 1}: 3 pasal"))
    assert text_current(rec(PARSER_REDO_BELOW, reparse_error=f"v{PARSER_VERSION}: 3 pasal"))
    assert not text_current(rec(PARSER_REDO_BELOW, parse_error="LeakedMarkupError"))

    assert not text_current({"versions": [{"text": "t.txt", "parser_version": PARSER_VERSION,
                                           "pdf_source": "peraturan.go.id"}]})  # not from BPK yet
    assert not text_current({"parser_version_tried": PARSER_VERSION - 1})
    assert text_current({"parser_version_tried": PARSER_VERSION})


def test_ocr_texts_have_their_own_redo_threshold():
    """A fix to scanned pages only (OCR_REDO_BELOW) redoes OCR'd texts, not typed ones."""
    from hukum_rapih.pdf.structure import OCR_REDO_BELOW, PARSER_REDO_BELOW
    from hukum_rapih.sources.peraturan_bpk import SOURCE, text_current

    def rec(version, ocr):
        v = {"id": "x", "text": "x.txt", "parser_version": version, "pdf_source": SOURCE,
             **({"ocr": True, "ocr_engine": "indra"} if ocr else {})}
        return {"versions": [v]}

    assert PARSER_REDO_BELOW < OCR_REDO_BELOW
    assert text_current(rec(OCR_REDO_BELOW - 1, ocr=False))          # typed: kept
    assert not text_current(rec(OCR_REDO_BELOW - 1, ocr=True))       # scanned: redone
    assert text_current(rec(OCR_REDO_BELOW, ocr=True))


def test_texts_from_another_engine_are_redone(monkeypatch):
    """Decision 0012: OCR'd texts read by Tesseract are redone with Indra; typed texts are not."""
    from hukum_rapih.pdf.structure import PARSER_VERSION
    from hukum_rapih.sources.peraturan_bpk import SOURCE, text_current

    monkeypatch.delenv("HUKUM_RAPIH_OCR", raising=False)
    typed = {"text": "a.txt", "parser_version": PARSER_VERSION, "pdf_source": SOURCE}
    assert text_current({"versions": [typed]})
    assert not text_current({"versions": [{**typed, "ocr": True}]})                       # Tesseract (no engine recorded)
    assert not text_current({"versions": [{**typed, "ocr": True, "ocr_engine": "tesseract"}]})
    assert text_current({"versions": [{**typed, "ocr": True, "ocr_engine": "indra"}]})
    assert text_current({"versions": [{**typed, "ocr": True}], "parser_version_tried": PARSER_VERSION})


def test_a_record_flagged_by_the_check_is_redone():
    from hukum_rapih.pdf.structure import PARSER_VERSION
    from hukum_rapih.sources.peraturan_bpk import SOURCE, text_current

    rec = {"versions": [{"text": "t.txt", "parser_version": PARSER_VERSION, "pdf_source": SOURCE}]}
    assert text_current(rec)
    assert not text_current({**rec, "recheck": "missed heading in body 3"})
