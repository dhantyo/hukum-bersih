"""The corpus JSON writer: its bytes equal ``JSON.stringify`` (hukum_rapih.corpus.write)."""

import json
import os
from pathlib import Path

import pytest

from hukum_rapih.corpus.write import UNDEFINED, dumps, js_object, write_json

FIXTURE = Path(__file__).parent / "fixtures" / "js_stringify.json"   # written by node


def test_a_file_written_by_javascript_comes_back_as_the_same_bytes():
    raw = FIXTURE.read_text(encoding="utf-8")

    assert dumps(json.loads(raw)) == raw


def test_the_same_value_built_in_python_gives_the_javascript_bytes():
    value = js_object([
        ("path", "/uu/4/2009/"), ("year", 2009), ("zero", 0), ("neg", -3), ("big", 123456789012),
        ("frac", 0.5), ("tiny", 0.0001), ("nul", None), ("yes", True), ("no", False),
        ("gone", UNDEFINED),
        ("text", 'Djakarta "jang" \\ /       \u007f \U0001f600 PENDJELASAN é 世界'),
        ("controls", "\x00\x01\b\t\n\x0b\f\r\x1f"),
        ("list", [1, UNDEFINED, "x", [], {}, {"a": UNDEFINED}]),
        ("10", "ten"), ("2", "two"), ("b", 1), ("01", "lead"),
        ("4294967295", "past the last index"), ("4294967294", "last index"),
        ("nested", {"tag": "p", "children": [], "eId": "p_1", "text": ""}),
    ])

    assert dumps(value) == FIXTURE.read_text(encoding="utf-8")


def test_a_whole_number_has_no_fraction_and_a_number_python_prints_differently_is_refused():
    assert dumps({"n": 3.0, "m": -0.0, "k": float("nan")}) == '{"n":3,"m":0,"k":null}\n'
    with pytest.raises(ValueError):
        dumps(1e-7)


def test_integer_keys_come_first_in_ascending_order_and_a_repeated_key_keeps_its_place():
    pairs = [("b", 1), ("27", "x"), ("4", "y"), ("27A", "z"), ("b", 2)]

    assert list(js_object(pairs).items()) == [("4", "y"), ("27", "x"), ("b", 2), ("27A", "z")]


def test_write_json_creates_folders_and_never_overwrites(tmp_path):
    target = tmp_path / "laws" / "uu" / "4" / "2009" / "index.json"

    write_json(target, {"a": 1})

    assert target.read_bytes() == b'{"a":1}\n'
    with pytest.raises(FileExistsError):
        write_json(target, {"a": 2})


def test_the_final_newline_can_be_left_out(tmp_path):
    assert dumps({"n": 1}, newline=False) == '{"n":1}'

    write_json(tmp_path / "a.json", {"n": 1}, newline=False)

    assert (tmp_path / "a.json").read_bytes() == b'{"n":1}'


@pytest.mark.skipif("CORPUS_REFERENCE" not in os.environ,
                    reason="set CORPUS_REFERENCE to a stage the TypeScript export wrote")
def test_every_reference_law_file_round_trips_to_the_same_bytes():
    files = sorted((Path(os.environ["CORPUS_REFERENCE"]) / "laws").rglob("*.json"))

    assert files
    for path in files:
        raw = path.read_bytes().decode("utf-8")
        assert dumps(json.loads(raw)) == raw, path
