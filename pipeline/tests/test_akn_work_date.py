"""The Work's FRBRdate is the law's full date (AKN 3.0 schema), never a made-up one."""

from lxml import etree

from hukum_bersih.akn.build import to_akn

TEXT = "BODY\n\n  ART 1 - Pasal 1\n\n    Teks.\n"


def work_dates(xml: bytes) -> list[str]:
    return etree.fromstring(xml).xpath(
        "//*[local-name()='FRBRWork']/*[local-name()='FRBRdate']/@date")


def test_the_work_date_is_the_enactment_date():
    assert work_dates(to_akn(TEXT, "/akn/id/act/uu/2009/4", work_date="2009-01-12")) == ["2009-01-12"]


def test_without_a_full_date_the_year_stays():
    assert work_dates(to_akn(TEXT, "/akn/id/act/uu/1954/38")) == ["1954"]
    assert work_dates(to_akn(TEXT, "/akn/id/act/uu/1954/38", work_date="1954")) == ["1954"]
