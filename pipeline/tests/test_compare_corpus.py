"""scripts/compare_corpus.py: what it reports for two stages."""

import importlib.util
from pathlib import Path

SCRIPT = Path(__file__).parents[1] / "scripts" / "compare_corpus.py"
spec = importlib.util.spec_from_file_location("compare_corpus", SCRIPT)
compare_corpus = importlib.util.module_from_spec(spec)
spec.loader.exec_module(compare_corpus)


def _stage(root: Path, files: dict[str, str]) -> Path:
    for name, text in files.items():
        (root / name).parent.mkdir(parents=True, exist_ok=True)
        (root / name).write_text(text, encoding="utf-8")
    return root


def test_reports_identical_differing_missing_and_extra_files(tmp_path, capsys):
    a = _stage(tmp_path / "a", {"laws/1.json": '{"x":1}\n', "laws/2.json": '{"x":"abc"}\n',
                                "laws/3.json": "{}\n", "other/4.json": "{}\n"})
    b = _stage(tmp_path / "b", {"laws/1.json": '{"x":1}\n', "laws/2.json": '{"x":"abd"}\n',
                                "laws/5.json": "{}\n"})

    status = compare_corpus.main([str(a), str(b), "--under", "laws"])

    out = capsys.readouterr().out
    assert status == 1
    assert "laws/2.json: first difference at byte 8" in out
    assert "missing from b: laws/3.json" in out
    assert "extra in b: laws/5.json" in out
    assert "other/4.json" not in out
    assert "1 identical, 1 differing, 1 missing, 1 extra" in out


def test_equal_stages_exit_zero(tmp_path, capsys):
    a = _stage(tmp_path / "a", {"laws/1.json": "{}\n"})
    b = _stage(tmp_path / "b", {"laws/1.json": "{}\n"})

    assert compare_corpus.main([str(a), str(b)]) == 0
    assert "1 identical, 0 differing, 0 missing, 0 extra" in capsys.readouterr().out
