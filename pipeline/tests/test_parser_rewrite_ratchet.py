"""The structure layer stays a table.

`pdf/structure.py` reads classified lines with a state machine: `TABLE` maps each `State` to the
cells it tries in order (docs/parser-rules.md, "Structure"). A new or changed rule is a cell, or
a guard of one, in the state it belongs to; not an `if` in the driver or in an action, which is
how the old `Parser` hid its states in the order of its branches. So the old class stays gone,
only the driver reads the state, and the module's `if` statements may only shrink: when a change
removes some, lower BASELINE_IFS in the same commit.
"""

import ast
from pathlib import Path

STRUCTURE = Path(__file__).parents[1] / "src" / "hukum_rapih" / "pdf" / "structure.py"

BASELINE_IFS = 31


def _module() -> ast.Module:
    return ast.parse(STRUCTURE.read_text(encoding="utf-8"))


def _functions_that(module: ast.Module, ctx: type) -> set[str]:
    return {
        function.name
        for function in ast.walk(module)
        if isinstance(function, ast.FunctionDef)
        for node in ast.walk(function)
        if isinstance(node, ast.Attribute) and node.attr == "state" and isinstance(node.ctx, ctx)
    }


def test_the_old_parser_stays_gone() -> None:
    classes = {node.name for node in _module().body if isinstance(node, ast.ClassDef)}
    assert "Parser" not in classes, "Structure rules are cells of TABLE (docs/parser-rules.md)."


def test_only_the_driver_reads_the_state() -> None:
    module = _module()
    assert _functions_that(module, ast.Load) == {"step"}, (
        "A guard or action that tests the state is a state hidden in a branch: give the rule a "
        "cell in that state's row of TABLE instead."
    )
    assert _functions_that(module, ast.Store) == {"enter"}


def test_if_statements_only_shrink() -> None:
    ifs = sum(isinstance(node, ast.If) for node in ast.walk(_module()))
    assert ifs <= BASELINE_IFS, (
        f"pdf/structure.py has {ifs} if statements, the baseline is {BASELINE_IFS}. Add the rule "
        "as a cell (a guard and an action) in TABLE, not as a branch."
    )
    assert ifs == BASELINE_IFS, f"pdf/structure.py has {ifs} if statements: set BASELINE_IFS = {ifs}."
