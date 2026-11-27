"""The old parser may only shrink.

`Parser` in `pdf/structure.py` is being replaced by the three layers planned in
`docs/parser-rules.md` ("Design for the rewrite"). Any change to the class must also move
logic out of it: fewer `if` branches or fewer state attributes than the recorded baseline.
A change that only adds to it, or edits it in place, fails here. When a change shrinks it,
lower the baseline to the new numbers and update the fingerprint in the same commit.
"""

import ast
import hashlib
from pathlib import Path

STRUCTURE = Path(__file__).parents[1] / "src" / "hukum_bersih" / "pdf" / "structure.py"

BASELINE_FINGERPRINT = "5efc8ec1976282a1"
BASELINE_BRANCHES = 27
BASELINE_STATE = 6


def _parser() -> ast.ClassDef:
    tree = ast.parse(STRUCTURE.read_text(encoding="utf-8"))
    return next(
        node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == "Parser"
    )


def _fingerprint(parser: ast.ClassDef) -> str:
    return hashlib.sha256(ast.dump(parser).encode()).hexdigest()[:16]


def _branches(parser: ast.ClassDef) -> int:
    return sum(isinstance(node, ast.If) for node in ast.walk(parser))


def _state(parser: ast.ClassDef) -> int:
    return len(
        {
            node.attr
            for node in ast.walk(parser)
            if isinstance(node, ast.Attribute)
            and isinstance(node.value, ast.Name)
            and node.value.id == "self"
            and isinstance(node.ctx, ast.Store)
        }
    )


def test_old_parser_only_shrinks() -> None:
    parser = _parser()
    branches = _branches(parser)
    state = _state(parser)

    assert branches <= BASELINE_BRANCHES, (
        f"Parser has {branches} if branches, the baseline is {BASELINE_BRANCHES}. "
        "Add new rules in the rewrite's layers (docs/parser-rules.md), not in Parser."
    )
    assert state <= BASELINE_STATE, (
        f"Parser has {state} state attributes, the baseline is {BASELINE_STATE}. "
        "State belongs in the rewrite's state machine (docs/parser-rules.md)."
    )

    if _fingerprint(parser) == BASELINE_FINGERPRINT:
        return

    assert branches < BASELINE_BRANCHES or state < BASELINE_STATE, (
        "Parser changed without shrinking. Do the next step of the rewrite "
        "(docs/parser-rules.md, 'Design for the rewrite'): move the rule you are changing "
        "into the line registry or the state machine, then lower the baselines here."
    )
    assert (branches, state) == (BASELINE_BRANCHES, BASELINE_STATE), (
        f"Parser shrank to {branches} branches and {state} state attributes. Set "
        f"BASELINE_BRANCHES = {branches}, BASELINE_STATE = {state} and "
        f"BASELINE_FINGERPRINT = {_fingerprint(parser)!r} in this test."
    )
