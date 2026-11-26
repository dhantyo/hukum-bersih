"""The static files of the active release in the web app's public folder
(hukum_bersih.corpus.public)."""

import shutil
from pathlib import Path

import pytest

from hukum_bersih.cli import main
from hukum_bersih.corpus.public import write_public

STAGE = Path(__file__).parent / "fixtures" / "release_stage"
OLD = "a" * 64
NEW = "b" * 64


@pytest.fixture
def stage(tmp_path: Path) -> Path:
    copy = tmp_path / "stage"
    shutil.copytree(STAGE, copy)
    return copy


def test_the_catalog_and_the_index_land_at_their_served_paths(stage, tmp_path):
    public = tmp_path / "public"
    write_public(stage, public, NEW)
    catalog = public / "data" / NEW / "law-catalog.json"
    assert catalog.read_bytes() == (stage / "law-catalog.json").read_bytes()
    index = stage / "pagefind"
    files = [p.relative_to(index) for p in index.rglob("*") if p.is_file()]
    assert files
    for file in files:
        written = public / "search-index" / NEW / file
        assert written.read_bytes() == (index / file).read_bytes()


def test_older_releases_are_removed_and_other_files_kept(stage, tmp_path):
    public = tmp_path / "public"
    for parent in ("data", "search-index"):
        (public / parent / OLD).mkdir(parents=True)
        (public / parent / OLD / "stale.json").write_text("{}")
    (public / "data" / "notes").mkdir()
    (public / "_headers").write_text("x")
    write_public(stage, public, NEW)
    assert not (public / "data" / OLD).exists()
    assert not (public / "search-index" / OLD).exists()
    assert (public / "data" / "notes").is_dir()
    assert (public / "_headers").read_text() == "x"


def test_writing_twice_gives_the_same_files(stage, tmp_path):
    public = tmp_path / "public"
    write_public(stage, public, NEW)
    first = sorted(p.relative_to(public) for p in public.rglob("*"))
    (public / "search-index" / NEW / "left-over.js").write_text("")
    write_public(stage, public, NEW)
    assert sorted(p.relative_to(public) for p in public.rglob("*")) == first


def test_public_needs_publish(tmp_path, capsys):
    with pytest.raises(SystemExit):
        main(["export-corpus", str(tmp_path / "stage"), "--public", str(tmp_path / "public")])
    assert "--public needs --publish" in capsys.readouterr().err
