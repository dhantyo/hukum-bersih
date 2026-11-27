# 0022 A scheduled agent makes the judgement calls, through PRs

Date: 2026-11-28 · Decided by: the operator; change by Claude

## What

Some steps need judgement a rule cannot give: the order of a law's files, which copy of a
duplicate to keep, which Lampiran pages are pictures worth keeping and what to cut, and the
structure of an MK ruling the parser could not read. These go to one scheduled cloud routine
running Claude Code on Sonnet, on the operator's subscription (no API key).

1. The pipeline on Actions writes a queue to a queue branch: the first and last page of each
   file, preview images (PNG or JPEG) of flagged pages, the amar to read.
2. The routine reads the queue (a cloud session clones the repository over GitHub, which the
   default Limited network level allows) and writes its choices with a one-line reason each to
   small YAML files, then opens a PR to `main`. Images never reach `main`.
3. CI checks the files (each file once, ids exist); the operator reviews and merges.
4. After merge, Actions applies the choices through `save_record` and parses again; the
   self-checks (decision 0026) decide whether the result replaces the stored text.

Records store only the choice and its reason, never a role or a label for a file.

## Why

File names on BPK are typed by hand and follow no pattern, so a rule cannot order or classify
files reliably; reading the end of one file and the start of the next can. A PR keeps every
choice visible and reversible, and storing the choice means the agent runs once per record, not
on every reparse.

## What we gave up

- Work waits for the routine's schedule and the operator's review.
- A cloud routine instead of a desktop task, so it runs without the operator's computer, in the
  Claude cloud setup.
