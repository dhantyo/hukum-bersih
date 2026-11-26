"""scripts/compare_corpus.py: what it reports for two stages."""

import importlib.util
import json
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


def _comparison(parts: list[tuple[str, str]], number: int = 1) -> str:
    """A comparison file with one line; ``parts`` are (change, text), change being " ", "-" or "+"."""
    spelled = [{"value": text, "added": change == "+", "removed": change == "-"}
               for change, text in parts]
    return json.dumps({"counts": {"berubah": number}, "rows": [{"lines": [{"parts": spelled}]}]})


def test_word_diffs_that_group_the_same_texts_differently_are_counted_apart(tmp_path, capsys):
    a = _stage(tmp_path / "a", {
        "same.json": _comparison([(" ", "Pasal ")]),
        "regrouped.json": _comparison([(" ", "Pasal "), ("-", "5"), ("+", "6")]),
        "reworded.json": _comparison([(" ", "Pasal "), ("-", "5"), ("+", "6")]),
        "counted.json": _comparison([(" ", "Pasal ")]),
    })
    b = _stage(tmp_path / "b", {
        "same.json": _comparison([(" ", "Pasal ")]),
        "regrouped.json": _comparison([("-", "Pasal 5"), ("+", "Pasal 6")]),
        "reworded.json": _comparison([(" ", "Pasal "), ("-", "5"), ("+", "7")]),
        "counted.json": _comparison([(" ", "Pasal ")], number=2),
    })

    status = compare_corpus.main([str(a), str(b), "--word-diff-parts"])

    out = capsys.readouterr().out
    assert status == 1
    assert "1 differ only in word-diff grouping" in out
    assert "reworded.json: first difference" in out
    assert "counted.json: first difference" in out
    assert "1 identical, 2 differing, 0 missing, 0 extra" in out


def test_regrouped_word_diffs_alone_exit_zero(tmp_path, capsys):
    a = _stage(tmp_path / "a", {"c.json": _comparison([(" ", "a "), ("-", "b"), ("+", "c")])})
    b = _stage(tmp_path / "b", {"c.json": _comparison([("-", "a b"), ("+", "a c")])})

    assert compare_corpus.main([str(a), str(b), "--word-diff-parts"]) == 0
    assert compare_corpus.main([str(a), str(b)]) == 1
