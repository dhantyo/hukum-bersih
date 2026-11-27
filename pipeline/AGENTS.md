# Pipeline notes

Run everything with `uv` from this folder. `uv sync --extra ocr` adds Indra OCR; `--extra bpk` adds the BPK browser tools.

## Parser changes (`src/hukum_bersih/pdf/`, `akn/`, `closing.py`)

- **Structure is a state machine: a rule is a cell of `TABLE` in `pdf/structure.py`, not an `if`.** `tests/test_parser_rewrite_ratchet.py` enforces it. Read "Structure" and "Design for the rewrite" in `docs/parser-rules.md` before you change `pdf/structure.py`.
- Recipe for a new or changed rule: "How to add or change a rule" in `docs/parser-rules.md`. Debug with `uv run hukum-bersih explain <law-id|PDF|text>`.
- Keep the regression set green: `uv run python scripts/regress.py` (laws and expected counts in `tests/regression.yaml`). `parser-regression.yml` runs it on push, with optional OCR-fix report and stored-vs-new comparison inputs.
- Compare a stored text with a fresh parse with `scripts/compare_reparse.py <id>...`. Judge OCR spell-fix changes with `scripts/ocr_fix_report.py N [seed]`. Run the OCR-heavy ones through `parser-regression.yml`, not locally.
- Bump `PARSER_VERSION` in `pdf/structure.py` and add a line to its comment for each change. Note bigger findings in `docs/parser-review-2026-11.md`.
- Don't redo good work. A new parser version re-converts only flagged records and texts older than `PARSER_REDO_BELOW` (`OCR_REDO_BELOW` for OCR'd texts). Raise them only for a fix that changes laws passing every check. The rule is `text_current` in `sources/peraturan_bpk.py`.
- A stored text is replaced only by a parse that keeps its pasal and `WORDS_KEPT` of its words, both measured on the stored text itself, not on the record's `pasal_count` (`measure`, `_poorer_than_stored` in `sources/peraturan_go_id.py`); otherwise the record gets `reparse_error`.
- Bump `OCR_CACHE_VERSION` (`pdf/ocr_cache.py`) when the OCR call changes. OCR rules are data in `pdf/ocr_rules/` (decision 0013).

## Records and Akoma Ntoso

- Read and write law records only through `load_record` / `save_record` (`records.py`). Add a new field to the schema there first. `relations.py` and `history.py` write `relationships` and `history`; both run in `hukum-bersih relations`, are idempotent and are never edited by hand.
- Before touching `akn/` or a workflow, run `hukum-bersih build-akn --out <dir>` then `uv run python scripts/validate_akn.py <dir>` (OASIS 3.0 XSD) and actionlint, as `ci.yml` does. Laws with no known date keep the bare year and are listed, not failed.
- Lint and test: `uv run ruff check .` and `uv run pytest`. Tests are grouped by topic (`tests/test_headings.py`, `test_penjelasan.py`, ...), not by parser version.
