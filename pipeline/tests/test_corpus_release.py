"""Release publish and activate (hukum_bersih.corpus.release), as the website's corpus reader and
the preview workflow depend on them."""

import shutil
from pathlib import Path

import pytest

from hukum_bersih.cli import main
from hukum_bersih.corpus.release import ReleaseError, activate, publish, release_digest

STAGE = Path(__file__).parent / "fixtures" / "release_stage"

# The id the TypeScript `corpus-release publish` gave this stage (2026-11-25, before that script
# was deleted). The stage has names that sort differently by code point and by UTF-16 unit.
TYPESCRIPT_ID = "4887a92a34e85ce69e1b8bc853ab16ff483e3739c3c9cc1e4ad2676624dcab66"


@pytest.fixture
def stage(tmp_path: Path) -> Path:
    copy = tmp_path / "stage"
    shutil.copytree(STAGE, copy)
    return copy


def test_the_id_is_the_one_the_typescript_release_tool_gave(stage, tmp_path):
    corpus = tmp_path / "corpus"
    assert publish(stage, corpus) == TYPESCRIPT_ID
    assert (corpus / "active-release").read_text() == f"{TYPESCRIPT_ID}\n"
    released = corpus / "releases" / TYPESCRIPT_ID
    assert (released / "release-id").read_text() == f"{TYPESCRIPT_ID}\n"
    assert (released / "laws/uu/1/2020/index.json").exists()
    assert not (released / "NOTES.txt").exists()   # only the corpus parts are released


def test_publishing_the_same_stage_twice_changes_nothing(stage, tmp_path):
    corpus = tmp_path / "corpus"
    first = publish(stage, corpus)
    before = sorted(p.relative_to(corpus) for p in corpus.rglob("*"))
    assert publish(stage, corpus) == first
    assert sorted(p.relative_to(corpus) for p in corpus.rglob("*")) == before


def test_a_changed_file_is_a_new_release_and_activate_goes_back(stage, tmp_path):
    corpus = tmp_path / "corpus"
    old = publish(stage, corpus)
    (stage / "law-catalog.json").write_text('[{"id":"uu_1_2020"}]\n')
    new = publish(stage, corpus)
    assert new != old
    assert (corpus / "active-release").read_text() == f"{new}\n"
    activate(old, corpus)
    assert (corpus / "active-release").read_text() == f"{old}\n"
    assert {p.name for p in (corpus / "releases").iterdir()} == {old, new}


def test_no_scratch_folder_is_left_behind(stage, tmp_path):
    corpus = tmp_path / "corpus"
    publish(stage, corpus)
    assert sorted(p.name for p in corpus.iterdir()) == ["active-release", "releases"]


def test_an_unknown_or_malformed_release_is_not_activated(tmp_path):
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    with pytest.raises(ReleaseError, match="Invalid release ID"):
        activate("../etc", corpus)
    with pytest.raises(ReleaseError, match="incomplete"):
        activate("a" * 64, corpus)
    with pytest.raises(ReleaseError, match="incomplete"):
        activate("a" * 64, tmp_path / "no-such-corpus")
    assert not (corpus / "active-release").exists()


def test_a_release_without_its_ready_marker_is_not_activated(stage, tmp_path):
    corpus = tmp_path / "corpus"
    release = publish(stage, corpus)
    (corpus / "releases" / release / "release-id").unlink()
    with pytest.raises(ReleaseError, match="incomplete"):
        activate(release, corpus)


@pytest.mark.parametrize("missing", ["pagefind", "law-catalog.json", "listings", "laws"])
def test_a_stage_missing_a_required_part_is_refused(stage, tmp_path, missing):
    target = stage / missing
    if target.is_dir():
        shutil.rmtree(target)
    else:
        target.unlink()
    with pytest.raises(ReleaseError, match=missing):
        publish(stage, tmp_path / "corpus")
    assert not (tmp_path / "corpus" / "active-release").exists()


def test_an_index_without_its_script_is_refused(stage, tmp_path):
    (stage / "pagefind/pagefind.js").unlink()
    with pytest.raises(ReleaseError, match="no Pagefind index"):
        publish(stage, tmp_path / "corpus")


def test_an_index_with_no_pages_is_refused(stage, tmp_path):
    (stage / "pagefind/pagefind-entry.json").write_text('{"languages":{"id":{"page_count":0}}}')
    with pytest.raises(ReleaseError, match="no searchable"):
        publish(stage, tmp_path / "corpus")


def test_a_symlink_in_the_stage_is_refused(stage, tmp_path):
    (stage / "drafts" / "link.json").symlink_to(stage / "law-catalog.json")
    with pytest.raises(ReleaseError, match="regular files"):
        publish(stage, tmp_path / "corpus")


def test_the_digest_follows_content_and_path_not_time(stage, tmp_path):
    digest = release_digest(stage / "drafts")
    other = tmp_path / "other"
    shutil.copytree(stage / "drafts", other)
    assert release_digest(other) == digest
    (other / "é.json").write_text('{"d":4}\n')
    assert release_digest(other) != digest


def test_the_command_publishes_and_switches_back(stage, tmp_path, capsys):
    corpus = tmp_path / "corpus"
    assert main(["release", "publish", str(stage), "--corpus", str(corpus)]) == 0
    assert capsys.readouterr().out == f"{TYPESCRIPT_ID}\n"
    (stage / "law-catalog.json").write_text("[1]\n")
    assert main(["release", "publish", str(stage), "--corpus", str(corpus)]) == 0
    assert main(["release", "activate", TYPESCRIPT_ID, "--corpus", str(corpus)]) == 0
    assert (corpus / "active-release").read_text() == f"{TYPESCRIPT_ID}\n"
    assert main(["release", "activate", "b" * 64, "--corpus", str(corpus)]) == 1
