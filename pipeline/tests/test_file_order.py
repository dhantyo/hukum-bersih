"""The file order of a law with several BPK files (decisions 0022, 0023): the queue the routine
reads, its answer checked and moved onto the record, and the files joined in that order."""
from pathlib import Path

import pytest
import yaml
from recfactory import make_record

from hukum_rapih import file_order
from hukum_rapih.akn.bluebell import to_bluebell
from hukum_rapih.checks import run_checks
from hukum_rapih.manifest import sha256_file
from hukum_rapih.pdf.structure import PARSER_VERSION, parse_lines
from hukum_rapih.records import load_record, save_record
from hukum_rapih.sources import peraturan_bpk as bpk

DATA = Path(__file__).resolve().parents[2] / "data"

LAMPIRAN, LAW, COPY = 10, 20, 30          # bpk_file_id of the made-up law's files, as BPK lists them
ANSWER = {"order": [LAW, LAMPIRAN], "skip": [{"bpk_file_id": COPY, "reason": "a copy of 20"}],
          "reason": "the law, then its Lampiran"}

LAW_LINES = ["UNDANG-UNDANG REPUBLIK INDONESIA", "NOMOR 1 TAHUN 2020", "TENTANG UJI COBA",
             "DENGAN RAHMAT TUHAN YANG MAHA ESA", "PRESIDEN REPUBLIK INDONESIA,",
             "Menimbang : a. bahwa uji coba perlu diatur;", "Pasal 1", "satu " * 8, "Pasal 2",
             "dua " * 8, "Disahkan di Jakarta", "pada tanggal 1 Mei 2020"]
LAMPIRAN_LINES = ["LAMPIRAN", "UNDANG-UNDANG REPUBLIK INDONESIA", "NOMOR 1 TAHUN 2020",
                  "DAFTAR TARIF UJI COBA", "tarif pertama", "tarif kedua"]
PENJELASAN_LINES = ["PENJELASAN", "ATAS", "UNDANG-UNDANG REPUBLIK INDONESIA", "NOMOR 1 TAHUN 2020",
                    "TENTANG UJI COBA", "I. UMUM", "Uji coba perlu diatur.", "II. PASAL DEMI PASAL",
                    "Pasal 1", "Cukup jelas.", "Pasal 2", "Cukup jelas."]


def bpk_file(i: int, name: str) -> dict:
    return {"url": f"https://peraturan.bpk.go.id/Download/{i}/{name}", "bpk_file_id": i, "filename": name}


def record(**bpk_over) -> dict:
    files = [bpk_file(LAMPIRAN, "UU_NO_1_2020_Lampiran.pdf"), bpk_file(LAW, "UU Nomor 1 Tahun 2020.pdf"),
             bpk_file(COPY, "UU Nomor 1 Tahun 2020 (1).pdf")]
    return make_record("uu_1_2020", tanggal_penetapan="2020-05-01",
                       bpk={"id": 1, "files": files, **bpk_over})


def ids(files: list[dict]) -> list[int]:
    return [f["bpk_file_id"] for f in files]


def saved(data: Path, rec: dict) -> Path:
    path = bpk.record_path(data, rec["id"])
    path.parent.mkdir(parents=True, exist_ok=True)
    save_record(path, rec)
    return path


def answer_file(data: Path, answer: dict) -> Path:
    path = data / file_order.ANSWERS / "uu_1_2020.yaml"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(yaml.safe_dump(answer))
    return path


def pdf_of(path: Path, *pages: list[str]) -> Path:
    import pymupdf

    doc = pymupdf.open()
    for lines in pages:
        page = doc.new_page()
        for k, line in enumerate(lines):
            page.insert_text((72, 72 + 20 * k), line)
    doc.save(path)
    return path


# ---- the answer ----------------------------------------------------------------------------

def test_an_answer_that_orders_or_skips_each_file_once_can_be_applied():
    assert file_order.answer_problems(record(), ANSWER) == []


@pytest.mark.parametrize(("change", "problem"), [
    ({"order": [LAW, LAMPIRAN, 99]}, "99 is not a file of the law"),
    ({"order": [LAW, LAMPIRAN, LAW]}, f"{LAW} is named 2 times"),
    ({"skip": []}, f"{COPY} is neither ordered nor skipped"),
    ({"order": [], "skip": [{"bpk_file_id": i, "reason": "x"} for i in (LAMPIRAN, LAW, COPY)]},
     "order: List should have at least 1 item"),
])
def test_an_answer_that_does_not_cannot_be_applied(change, problem):
    problems = file_order.answer_problems(record(), {**ANSWER, **change})
    assert any(p.startswith(problem) for p in problems), problems


def test_an_answer_needs_its_law():
    assert file_order.answer_problems(None, ANSWER) == ["no such law in data/"]


@pytest.mark.parametrize("answer", sorted((DATA / file_order.ANSWERS).glob("*.yaml")),
                         ids=lambda p: p.stem)
def test_every_answer_in_data_can_be_applied(answer):
    _, rec, raw = file_order.read_answer(DATA, answer)
    assert file_order.answer_problems(rec, raw) == []


# ---- apply ---------------------------------------------------------------------------------

def test_apply_moves_the_answer_onto_the_record_for_the_importer(tmp_path):
    tried = {**record(), "parser_version_tried": PARSER_VERSION,
             "reparse_error": f"v{PARSER_VERSION}: no pasal found"}
    assert bpk.text_current(tried)                       # the importer would leave it alone
    path, answer = saved(tmp_path, tried), answer_file(tmp_path, ANSWER)

    assert list(file_order.apply(tmp_path)) == ["ok   uu_1_2020"]
    rec = load_record(path)
    assert rec["bpk"]["file_order"] == ANSWER and not answer.exists()
    assert not bpk.text_current(rec)                     # read again, with the new order
    assert list(file_order.apply(tmp_path)) == []        # done: nothing left to apply
    assert load_record(path) == rec


def test_a_bad_answer_is_reported_and_left_in_place(tmp_path):
    path, answer = saved(tmp_path, record()), answer_file(tmp_path, {**ANSWER, "skip": []})
    assert list(file_order.apply(tmp_path)) == [f"FAIL uu_1_2020: {COPY} is neither ordered nor skipped"]
    assert answer.exists() and "file_order" not in load_record(path)["bpk"]


# ---- the join ------------------------------------------------------------------------------

def test_without_an_order_only_the_first_file_not_named_penjelasan_is_read():
    # UU 23/1968: BPK lists its Lampiran first, so the law itself was never read
    assert ids(bpk.files_to_read(record()["bpk"])) == [LAMPIRAN]


def test_an_order_is_read_as_given_without_the_skipped_files():
    assert ids(bpk.files_to_read(record(file_order=ANSWER)["bpk"])) == [LAW, LAMPIRAN]


def test_an_order_that_no_longer_names_every_file_is_set_aside():
    rec = record(file_order=ANSWER)
    rec["bpk"]["files"].append(bpk_file(40, "UU Nomor 1 Tahun 2020 penjelasan.pdf"))  # BPK added one
    assert ids(bpk.files_to_read(rec["bpk"])) == [LAMPIRAN, 40]                     # today's rule
    assert file_order.needs_order(rec)                                               # queued again


def test_the_files_are_joined_in_the_order_given(tmp_path, monkeypatch):
    import urllib.request

    pdfs = {LAMPIRAN: pdf_of(tmp_path / "lampiran.pdf", LAMPIRAN_LINES),
            LAW: pdf_of(tmp_path / "law.pdf", LAW_LINES),
            COPY: pdf_of(tmp_path / "copy.pdf", LAW_LINES + ["SALINAN"])}
    rec = {**record(file_order=ANSWER), "recheck": file_order.RECHECK}
    for f in rec["bpk"]["files"]:
        f.update(sha256=sha256_file(pdfs[f["bpk_file_id"]]), archive_url=f"https://archive.org/{f['bpk_file_id']}")
    path = saved(tmp_path, rec)
    monkeypatch.setattr(urllib.request, "urlretrieve",
                        lambda url, dest: dest.write_bytes(pdfs[int(url.rsplit("/", 1)[1])].read_bytes()))

    assert list(bpk.reparse(tmp_path)) == ["ok   uu_1_2020: reparsed, 2 pasal"]
    v = load_record(path)["versions"][0]
    assert v["pdf_sha256"] == sha256_file(pdfs[LAW]) and v["extra_pdf_sha256"] == [sha256_file(pdfs[LAMPIRAN])]
    text = (path.parent / v["text"]).read_text()
    assert text.startswith("PREFACE\n  UNDANG-UNDANG") and text.index("ART 2") < text.index("tarif pertama")
    assert "front_matter" not in [c["name"] for c in v["checks"]["failed"]]


@pytest.mark.parametrize(("lines", "opens_with_the_law"), [
    (LAW_LINES + PENJELASAN_LINES, True),
    (PENJELASAN_LINES + LAW_LINES, False),
    (LAMPIRAN_LINES + LAW_LINES, False),
])
def test_files_joined_in_the_wrong_order_lack_the_front_matter(lines, opens_with_the_law):
    text = to_bluebell(parse_lines(lines))
    failed = run_checks({"akn": "/akn/id/act/uu/2020/1"}, text).failed
    assert ("front_matter" not in failed) is opens_with_the_law, text[:300]


def test_no_line_is_joined_across_two_files(tmp_path):
    from hukum_rapih.pdf.structure import parse_pdf

    stats: dict = {}
    parse_pdf(pdf_of(tmp_path / "a.pdf", LAW_LINES), [pdf_of(tmp_path / "b.pdf", LAMPIRAN_LINES)], stats)
    joint = stats["lines"].index("LAMPIRAN")
    assert stats["lines"][joint - 1:joint + 1] == ["pada tanggal 1 Mei 2020", "LAMPIRAN"]


# ---- the queue -----------------------------------------------------------------------------

@pytest.mark.parametrize(("rec", "needs"), [
    (record(), True),
    (record(file_order=ANSWER), False),                                   # answered
    (record(id=bpk.UUD_BPK_ID), False),                                   # the UUD's entry
    (make_record("uu_1_2020", bpk={"id": 1, "files": [bpk_file(LAW, "UU 1 2020.pdf")]}), False),
])
def test_a_law_needs_an_order_when_bpk_lists_several_files_and_none_covers_them(rec, needs):
    assert file_order.needs_order(rec) is needs


class Response:
    def __init__(self, content: bytes):
        self.content, self.headers = content, {"content-type": "application/pdf"}


class Files:
    """Serves each BPK file by its URL; counts the downloads."""

    def __init__(self, pdfs: dict[str, Path]):
        self.pdfs, self.calls = pdfs, 0

    def get(self, url):
        self.calls += 1
        return Response(self.pdfs[url].read_bytes())


def test_the_queue_holds_the_ends_of_each_file_and_follows_data(tmp_path):
    data, queue = tmp_path / "data", tmp_path / "queue"
    rec = record()
    saved(data, rec)
    saved(data, make_record("uu_2_2020", bpk={"id": 2, "files": [bpk_file(50, "UU 2 2020.pdf")]}))
    session = Files({f["url"]: pdf_of(tmp_path / f"{f['bpk_file_id']}.pdf", [f"awal berkas {f['bpk_file_id']}"],
                                      ["tengah"], ["akhir berkas"]) for f in rec["bpk"]["files"]})

    assert list(file_order.collect(session, data, queue)) == ["ok   uu_1_2020: 3 files"]   # not uu_2_2020
    entry = yaml.safe_load((queue / "uu_1_2020.yaml").read_text())
    assert entry["files"][0] == {"bpk_file_id": LAMPIRAN, "filename": "UU_NO_1_2020_Lampiran.pdf",
                                 "pages": 3, "first_page": ["awal berkas 10"], "last_page": ["akhir berkas"]}
    assert ids(entry["files"]) == ids(rec["bpk"]["files"])

    downloads = session.calls
    assert list(file_order.collect(session, data, queue)) == []          # queued unchanged
    assert session.calls == downloads
    answer_file(data, ANSWER)
    assert list(file_order.collect(session, data, queue)) == ["gone uu_1_2020"]   # answered
    assert not (queue / "uu_1_2020.yaml").exists()
