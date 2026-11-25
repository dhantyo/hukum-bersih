"""The search records of the reader pages and the index built from them
(hukum_bersih.corpus.search, pagefind_index, anchors, titles)."""

import json
import time
from pathlib import Path

import pytest

from hukum_bersih.corpus.laws import Laws, export_laws
from hukum_bersih.corpus.pagefind_index import Record, write_index
from hukum_bersih.corpus.search import SearchRecords, text_records
from hukum_bersih.corpus.titles import draft_document_title, law_heading, tanggal

DATA = Path(__file__).resolve().parents[2] / "data"


def _p(text: str, eid: str | None = None) -> dict:
    return {"tag": "p", "children": [], "text": text, **({"eId": eid} if eid else {})}


def _node(tag: str, children: list[dict], eid: str | None = None, **fields: str) -> dict:
    return {"tag": tag, "children": children, **({"eId": eid} if eid else {}), **fields}


def _text(**parts) -> dict:
    return {"preface": [], "preamble": [], "body": [], "conclusions": [], "penjelasan": [],
            "anchors": {}, **parts}


def _records(text: dict) -> list[tuple[str, str, str]]:
    return [(r.url, r.label, r.content) for r in text_records("/uu/4/2009/", "Judul", text)]


# --- what a page is cut into -------------------------------------------------------------

def test_a_page_is_cut_into_opening_pasal_closing_and_penjelasan():
    text = _text(
        preface=[_node("block", [_p("UNDANG-UNDANG")])],
        preamble=[_node("block", [_p("Menimbang  bahwa")])],
        body=[_node("chapter", [
            _node("article", [_node("paragraph", [_p("Isi ayat satu.")], num="(1)")],
                  eid="art_4", num="4"),
            _node("article", [_p("Isi pasal dua puluh tujuh A.")], eid="art_27A", num="27A"),
        ], eid="chp_I", num="BAB I", heading="KETENTUAN UMUM")],
        conclusions=[_node("block", [_p("Disahkan di Djakarta")])],
        penjelasan=[_node("part", [_p("Penjelasan umum.")], num="I.", heading="UMUM")],
        anchors={"art_4": "pasal-4", "art_27A": "pasal-27a"},
    )

    assert _records(text) == [
        ("/uu/4/2009/", "Pembukaan", "UNDANG-UNDANG Menimbang bahwa"),
        ("/uu/4/2009/#pasal-4", "Pasal 4", "Pasal 4. (1) Isi ayat satu."),
        ("/uu/4/2009/#pasal-27a", "Pasal 27A", "Pasal 27A. Isi pasal dua puluh tujuh A."),
        ("/uu/4/2009/#penutup", "Pengesahan dan pengundangan", "Disahkan di Djakarta"),
        ("/uu/4/2009/#penjelasan", "Penjelasan I. UMUM", "I. UMUM Penjelasan umum."),
    ]


def test_a_pasal_without_a_short_anchor_is_found_by_its_element_id():
    text = _text(body=[_node("article", [_p("Izin dicabut.")], eid="art_7__2", num="7")],
                 anchors={"art_7": "pasal-7"})

    assert _records(text) == [("/uu/4/2009/#art_7__2", "Pasal 7", "Pasal 7. Izin dicabut.")]


def test_penjelasan_entries_carry_the_prefix_and_cukup_jelas_is_left_out():
    text = _text(penjelasan=[_node("part", [
        _node("article", [_p("Cukup jelas.")], eid="art_1", num="1"),
        _node("article", [_p("  CUKUP   JELAS ")], eid="art_2", num="2"),
        _node("article", [_p("Cukup jelas."), _p("Yang dimaksud dengan X ialah Y.")],
              eid="art_3", num="3"),
    ], num="II.", heading="PASAL DEMI PASAL")])

    assert _records(text) == [
        ("/uu/4/2009/#penjelasan-art_3", "Pasal 3 Penjelasan",
         "Pasal 3. Cukup jelas. Yang dimaksud dengan X ialah Y."),
    ]


def test_a_penjelasan_block_without_a_name_or_named_penjelasan_is_just_penjelasan():
    text = _text(penjelasan=[_node("part", [_p("Isi.")], num="PENJELASAN"),
                             _node("part", [_p("Lagi.")])])

    assert [(r[0], r[1]) for r in _records(text)] == [
        ("/uu/4/2009/#penjelasan", "Penjelasan"), ("/uu/4/2009/#penjelasan", "Penjelasan")]


def test_a_piece_with_nothing_to_search_for_has_no_record():
    text = _text(preface=[_node("block", [_p("---")])], conclusions=[_node("block", [_p("  ")])],
                 penjelasan=[_node("part", [_p("(…)")])])

    assert _records(text) == []


def test_a_cukup_jelas_is_matched_as_javascript_matches_it():
    ascii_only = _text(penjelasan=[_node("article", [_p("Cukup jelas.")], eid="a", num="1")])
    other_letters = _text(penjelasan=[_node("article", [_p("Cukup jelaſ.")], eid="a", num="1")])

    assert _records(ascii_only) == []
    assert len(_records(other_letters)) == 1


# --- headings and order ------------------------------------------------------------------

def test_headings_of_the_pages():
    assert law_heading("Pertambangan", "Undang-Undang Nomor 4 Tahun 2009") == "Pertambangan"
    assert law_heading("", "Undang-Undang Nomor 4 Tahun 2009") == "Undang-Undang Nomor 4 Tahun 2009"
    assert draft_document_title({"type": "draft", "date": "2023-05"}) == "Draf RUU · Mei 2023"
    assert draft_document_title({"type": "dim", "date": "2026-11-19"}) == (
        "Daftar Inventaris Masalah (DIM) · 19 November 2026")
    assert draft_document_title({"type": "lainnya", "date": "2008"}) == "lainnya · 2008"
    assert tanggal("2008") == "2008"


def test_the_laws_come_last_path_first_then_the_drafts_by_slug_with_documents_in_order():
    body = _text(body=[_node("article", [_p("Isi.")], eid="art_1", num="1")])
    search = SearchRecords()
    for page in ("/uu/9/2024/", "/uu/90/2024/", "/uu/9/2025/"):
        search.add_law(page, "Judul", body)
    search.add_draft_document("a", "/ruu/a/2023/", "Draf", body)
    search.add_draft_document("b", "/ruu/b/2023/", "Draf", body)
    search.add_draft_document("a", "/ruu/a/2026/", "Draf", body)

    assert [r.url.split("#")[0] for r in search] == [
        "/uu/90/2024/", "/uu/9/2025/", "/uu/9/2024/", "/ruu/b/2023/", "/ruu/a/2023/",
        "/ruu/a/2026/"]


def test_an_index_without_laws_is_refused(tmp_path):
    with pytest.raises(ValueError, match="no law documents"):
        SearchRecords().write(tmp_path)


# --- the Pagefind index ------------------------------------------------------------------

def test_the_index_holds_every_record_and_is_written_where_asked(tmp_path):
    out = tmp_path / "pagefind"
    records = [Record(f"/uu/{n}/2020/#pasal-1", f"Pasal 1. Informasi elektronik {n}", "Judul", "Pasal 1")
               for n in range(1200)]

    start = time.monotonic()
    write_index(records, out)

    # Pagefind's own reader takes 0.1 s a record: 2 minutes for these
    assert time.monotonic() - start < 60
    entry = json.loads((out / "pagefind-entry.json").read_text(encoding="utf-8"))
    assert entry["languages"]["id"]["page_count"] == 1200


# --- anchors against the reader text of real laws ----------------------------------------

SAMPLE = ["uu_11_2008", "uu_1_1974", "uu_5_1960", "uu_8_1981", "uu_13_2003", "uu_1_2023",
          "uu_20_2001", "uu_28_2014", "uu_1_1946", "uu_7_1992", "uu_30_2002", "uu_2_1960",
          "uu_12_2011", "uu_39_1999"]


def _ids_the_reader_renders(text: dict) -> set[str]:
    """The ids law-text.tsx puts in the page: every element id, each pasal's short alias, the
    two sections, and the element ids of the Penjelasan behind its prefix."""
    def element_ids(nodes: list[dict]) -> set[str]:
        return {i for n in nodes for i in [n.get("eId", ""), *element_ids(n["children"])] if i}

    body = element_ids([*text["preface"], *text["preamble"], *text["body"], *text["conclusions"]])
    explanation = {f"penjelasan-{i}" for i in element_ids(text["penjelasan"])}
    sections = {"penutup"} if text["conclusions"] else set()
    sections |= {"penjelasan"} if text["penjelasan"] else set()
    return body | explanation | sections | set(text["anchors"].values())


def _articles(nodes: list[dict]):
    for node in nodes:
        if node["tag"] == "article":
            yield node
        else:
            yield from _articles(node["children"])


@pytest.fixture(scope="module")
def sample(tmp_path_factory):
    """Real laws exported as ``export-corpus`` does, with the search records of each."""
    root = tmp_path_factory.mktemp("sample")
    for law_id in SAMPLE:
        year = law_id.rsplit("_", 1)[1]
        folder = root / "data" / "peraturan" / "uu" / year
        folder.mkdir(parents=True, exist_ok=True)
        (folder / law_id).symlink_to(DATA / "peraturan" / "uu" / year / law_id)
    stage, search = root / "stage", SearchRecords()
    export_laws(Laws(root / "data"), stage, search)
    laws = {}
    for path in (stage / "laws").rglob("index.json"):
        law = json.loads(path.read_text(encoding="utf-8"))
        laws[law["path"]] = law
    return laws, list(search)


@pytest.mark.skipif(not DATA.is_dir(), reason="the data folder is not here")
def test_every_record_opens_a_piece_the_reader_renders(sample):
    laws, records = sample
    assert len(laws) == len(SAMPLE)

    for path, law in laws.items():
        own = [r for r in records if r.url.split("#")[0] == path]
        rendered = _ids_the_reader_renders(law["text"])

        assert own
        assert {r.title for r in own} == {law["subject"] or law["title"]}
        fragments = [r.url.partition("#")[2] for r in own if "#" in r.url]
        assert set(fragments) <= rendered, (path, set(fragments) - rendered)


@pytest.mark.skipif(not DATA.is_dir(), reason="the data folder is not here")
def test_every_pasal_with_words_is_found_by_the_permalink_the_reader_shows(sample):
    laws, records = sample
    seen = 0

    for path, law in laws.items():
        text = law["text"]
        found = {r.url.partition("#")[2]: r.label for r in records if r.url.startswith(path)}
        for node in _articles(text["body"]):
            if node.get("eId"):
                permalink = text["anchors"].get(node["eId"], node["eId"])
                assert permalink in found, (path, node["eId"])
                assert found[permalink] == f"Pasal {node.get('num', '')}".strip()
                seen += 1

    assert seen > 500
