"""The Akoma Ntoso file of a law carries where the law sits, from its record (decision 0021):
built by ``build_peraturan`` from real records copied out of data/."""

import shutil
from datetime import date
from pathlib import Path

import pytest
from cobalt import Act
from lxml import etree

from hukum_rapih.akn.build import build_peraturan

DATA = Path(__file__).resolve().parents[2] / "data"
LAWS = ["uu/2008/uu_11_2008", "uu/2016/uu_19_2016", "uu/2024/uu_1_2024",
        "perppu/2008/perppu_4_2008", "uu/2015/uu_11_2015",
        "perppu/1961/perppu_1_1961", "uu/1961/uu_10_1961", "perppu/1960/perppu_2_1960"]
NS = {"a": "http://docs.oasis-open.org/legaldocml/ns/akn/3.0",
      "hr": "https://github.com/dhantyo/hukum-rapih/ns/akn"}


@pytest.fixture(scope="module")
def akn(tmp_path_factory):
    data = tmp_path_factory.mktemp("data")
    for law in LAWS:
        shutil.copytree(DATA / "peraturan" / law, data / "peraturan" / law)
    shutil.copytree(DATA / "koleksi", data / "koleksi")
    out = tmp_path_factory.mktemp("akn")
    by_law = {path.parent.name: path for path in build_peraturan(data, out)}
    assert sorted(by_law) == sorted(law.rsplit("/", 1)[1] for law in LAWS)
    return lambda law_id: by_law[law_id].read_bytes()


def xpath(xml: bytes, path: str) -> list:
    return etree.fromstring(xml).xpath(path, namespaces=NS)


def test_lifecycle_has_enactment_promulgation_and_entry_into_force(akn):
    events = [(e.get("eId"), e.get("date"), e.get("type"))
              for e in xpath(akn("uu_11_2008"), "//a:lifecycle/a:eventRef")]
    assert events == [("penetapan", "2008-04-21", "generation"),
                      ("pengundangan", "2008-04-21", None),
                      ("mulai-berlaku", "2010-04-21", None),
                      ("diubah-uu_19_2016", "2016-11-25", "amendment"),
                      ("diubah-uu_1_2024", "2024-01-02", "amendment")]


def test_cobalt_reads_the_amendments_and_the_publication(akn):
    act = Act(akn("uu_11_2008"))
    assert [(a.date, a.amending_uri, a.amending_title) for a in act.amendments] == [
        (date(2016, 11, 25), "/akn/id/act/uu/2016/19", "UU 19/2016"),
        (date(2024, 1, 2), "/akn/id/act/uu/2024/1", "UU 1/2024")]
    assert act.publication_date == date(2008, 4, 21)
    assert act.publication_number == "58"
    assert act.repeal is None


def test_each_version_is_in_force_until_the_next_one_starts(akn):
    groups = [(g.get("eId"), g[0].get("start"), g[0].get("end"))
              for g in xpath(akn("uu_11_2008"), "//a:temporalData/a:temporalGroup")]
    assert groups == [("uu_11_2008_2008-04-21", "#mulai-berlaku", "#diubah-uu_19_2016"),
                      ("uu_11_2008_2016-11-25", "#diubah-uu_19_2016", "#diubah-uu_1_2024"),
                      ("uu_11_2008_2024-01-02", "#diubah-uu_1_2024", None)]


def test_a_revoked_law_ends_when_the_revoking_law_takes_effect(akn):
    xml = akn("perppu_4_2008")
    repeal = Act(xml).repeal
    assert (repeal.date, repeal.repealing_uri) == (date(2015, 8, 6), "/akn/id/act/uu/2015/11")
    assert [(i.get("start"), i.get("end")) for i in xpath(xml, "//a:timeInterval")] == [
        ("#mulai-berlaku", "#dicabut-uu_11_2015")]


def test_a_law_no_longer_in_force_with_no_known_end_gets_no_open_interval(akn):
    assert xpath(akn("uu_10_1961"), "//a:temporalData") == []


def test_whole_law_relations_are_modifications(akn):
    amended = akn("uu_11_2008")
    assert [(m.get("type"), m.get("incomplete"), m[0].get("href"), m[1].get("href"))
            for m in xpath(amended, "//a:passiveModifications/*")] == [
        ("substitution", "true", "#uu_19_2016", "/akn/id/act/uu/2008/11"),
        ("substitution", "true", "#uu_1_2024", "/akn/id/act/uu/2008/11")]
    revoking = akn("uu_11_2015")
    assert [(m.get("type"), m[0].get("href"), m[1].get("href"))
            for m in xpath(revoking, "//a:activeModifications/a:textualMod")] == [
        ("repeal", "/akn/id/act/uu/2015/11", "#perppu_4_2008")]
    assert xpath(revoking, "//a:activeRef/@href") == ["/akn/id/act/perppu/2008/4"]
    assert xpath(akn("perppu_1_1961"), "//a:passiveModifications/a:legalSystemMod/@type") == [
        "conversion"]


def test_signer_place_and_initiator_are_tlc_entries(akn):
    xml = akn("uu_11_2008")
    tlcs = {(etree.QName(e).localname, e.get("eId")): (e.get("showAs"), e.get("href"))
            for e in xpath(xml, "//a:references/*[starts-with(local-name(), 'TLC')]")}
    assert tlcs[("TLCPerson", "pejabat-penetapan")] == (
        "SUSILO BAMBANG YUDHOYONO", "/ontology/person/id/susilo-bambang-yudhoyono")
    assert tlcs[("TLCLocation", "tempat-penetapan")] == ("Jakarta", "/ontology/location/id/jakarta")
    assert tlcs[("TLCOrganization", "pemrakarsa")] == (
        "PEMERINTAH PUSAT", "/ontology/organization/id/pemerintah-pusat")
    assert xpath(xml, "//a:eventRef[@eId='penetapan']/@refersTo") == [
        "#pejabat-penetapan #tempat-penetapan"]


def test_short_name_subjects_and_provenance(akn):
    xml = akn("uu_11_2008")
    assert xpath(xml, "//a:FRBRWork/a:FRBRalias[@name='short']/@value") == ["UU ITE"]
    assert xpath(xml, "//a:classification/a:keyword/@value") == [
        "PERS, POS, DAN PERIKLANAN", "TELEKOMUNIKASI, INFORMATIKA, SIBER, DAN INTERNET"]
    record = xpath(xml, "//a:proprietary/hr:record")[0]
    assert dict(record.attrib) == {
        "id": "uu_11_2008", "version": "uu_11_2008_2008-04-21",
        "source_url": "https://peraturan.bpk.go.id/Details/37589/uu-no-11-tahun-2008",
        "source_pdf_url": "https://peraturan.bpk.go.id/Download/26683/UU%20Nomor%2011%20Tahun%202008.pdf",
        "pdf_sha256": "3c174f55b4a7982af268a24316e3353c8e712fc8a57e87a9fdf0502da4ea0af3",
        "bpk_id": "37589"}


def test_fields_the_record_lacks_give_no_element(akn):
    xml = akn("perppu_2_1960")           # "LL SETNEG : 5 HLM": no Lembaran Negara; no signer
    assert xpath(xml, "//a:publication") == []
    assert xpath(xml, "//a:TLCPerson | //a:TLCOrganization[@eId='pemrakarsa']") == []
    assert xpath(xml, "//a:FRBRalias[@name='short'] | //a:analysis") == []
