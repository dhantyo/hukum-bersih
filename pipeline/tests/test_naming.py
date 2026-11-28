import pytest

from hukum_rapih.naming import validate_id


@pytest.mark.parametrize(
    "good",
    [
        "uu_11_2008",
        "uu_11_2008_2008-04-21",
        "uu_6_2023_2023-03-31_2",  # a version's second file
        "perppu_2_2022",
        "uu-drt_7_1955",
        "uud_1945",  # the constitution has no number (decision 0027)
        "uud_1945_1945",
        "uud-perubahan_1_1999_1999-10-19",
        "keppres_150_1959",
        "ruu_perampasan-aset_2026-11-19_draft-final",
        "ruu_perampasan-aset_2023-05_draft_pemerintah",
        "ruu_perampasan-aset_2026-11-09_dim_2",
        "ruu_perampasan-aset_2008_draft_ppatk",
    ],
)
def test_valid_ids(good):
    assert validate_id(good) == good


@pytest.mark.parametrize(
    "bad",
    [
        "UU_11_2008",
        "uu-11-2008",  # parts must be joined by _, not -
        "uu__11_2008",
        "_uu_11_2008",
        "uu_11_2008_",
        "uu_6_2023_2",  # file number only after a date
        "uu 11 2008",
        "",
        "a" * 101,
        "ruu_perampasan-aset_2026-11-19_draft-ruu-final",  # unknown type
        "ruu_perampasan-aset_draft-final",  # no date
        "uud_1950",  # only the UUD 1945 goes without a number
    ],
)
def test_invalid_ids(bad):
    with pytest.raises(ValueError):
        validate_id(bad)
