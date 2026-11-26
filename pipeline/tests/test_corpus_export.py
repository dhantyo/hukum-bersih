"""The order of the export steps (hukum_bersih.corpus.export): the search index is written while
the collections and the catalog are, and a failure in either fails the export."""

import threading

import pytest

from hukum_bersih.corpus import export


class _Search:
    """Stands in for ``SearchRecords``: ``write`` runs as long as ``indexing`` says."""

    def __init__(self, indexing):
        self.indexing = indexing

    def write(self, stage):
        return self.indexing(stage)


def _steps(monkeypatch, search, collections=lambda laws, stage: "collections line"):
    monkeypatch.setattr(export, "Laws", lambda data_dir: "laws")
    monkeypatch.setattr(export, "SearchRecords", lambda: search)
    monkeypatch.setattr(export, "export_laws", lambda laws, stage, records: "laws line")
    monkeypatch.setattr(export, "export_drafts", lambda data_dir, stage, records: "drafts line")
    monkeypatch.setattr(export, "export_collections", collections)
    monkeypatch.setattr(export, "export_catalog", lambda laws, data_dir, stage: "catalog line")


def test_the_index_is_written_while_the_collections_are_exported(monkeypatch, tmp_path):
    indexing_started = threading.Event()
    collections_started = threading.Event()

    def indexing(stage):
        indexing_started.set()
        assert collections_started.wait(timeout=5), "the collections never ran beside the index"
        return "search line"

    def collections(laws, stage):
        collections_started.set()
        assert indexing_started.wait(timeout=5), "the index was not started before the collections"
        return "collections line"

    _steps(monkeypatch, _Search(indexing), collections)

    lines = export._export(tmp_path, tmp_path / "stage")

    assert lines == ["laws line", "collections line", "drafts line", "catalog line", "search line"]


def test_a_failing_index_fails_the_export(monkeypatch, tmp_path):
    def indexing(stage):
        raise RuntimeError("pagefind failed")

    _steps(monkeypatch, _Search(indexing))

    with pytest.raises(RuntimeError, match="pagefind failed"):
        export._export(tmp_path, tmp_path / "stage")


def test_a_failing_collection_fails_the_export_after_the_index_is_done(monkeypatch, tmp_path):
    finished = threading.Event()

    def indexing(stage):
        finished.set()
        return "search line"

    def collections(laws, stage):
        raise RuntimeError("collections failed")

    _steps(monkeypatch, _Search(indexing), collections)

    with pytest.raises(RuntimeError, match="collections failed"):
        export._export(tmp_path, tmp_path / "stage")
    assert finished.is_set()
