# 0023 All files of a law are joined and parsed as one

Date: 2026-11-28 · Decided by: the operator; change by Claude

## What

When BPK lists several files for a law, all of them are joined in order and parsed as one text.
The parser finds the Penjelasan and the Lampiran in the text, as it does inside one PDF. Files
get no role.

- The order and the duplicates to skip come from the agent routine (decision 0022). File names
  with page ranges ("Hal. 1-150", "(i-409)") may be ordered by a script.
- A file boundary is a hard break: no line joins across it.
- The joined text must open with the law's front matter and its pasal must run on across each
  joint; otherwise the record is flagged and the stored text stays.
- Until a record is ordered, today's rule applies (`sources/peraturan_bpk.py`, `is_penjelasan`).

## Why

Today the importer reads the first file whose name lacks "penjelasan" plus the Penjelasan files
and skips the rest. Of 97 records with several files, 106 files are archived but never read
(measured 2026-11-27): lampiran parts (UU 60/2024 in six files), treaty texts, a body split in
two (UU 7/2017), Penjelasan named `_pjl` or `_Penj`, and copies. UU 23/1968 has no text because
BPK lists its lampiran first.

## What we gave up

- Large joined texts: UU 60/2024's lampiran runs to about 2,350 pages, partly scanned, so OCR
  runs on Actions.
- A record waits for the routine's order before it gains its other files.
