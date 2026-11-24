# 0014 No more uploads to archive.org

Date: 2026-11-24 · Decided by: the operator; change by Claude

## What

The project uploads nothing to archive.org, renames nothing there and deletes nothing there.
Removed: `archive.py`, `fetch.py`, the `fetch`, `archive-pending`, `archive-retitle` and
`archive-delete` commands and workflows, the upload step of `import-bpk` and `import-pdf`,
and the `internetarchive` and `pikepdf` dependencies (pikepdf only repaired PDFs archive.org
refused).

PDFs are kept only as a sha256 line in `data/sources/manifests/<host>.jsonl`; a PDF is
downloaded, parsed and discarded. The importers still record the hash and convert the text.

Kept, because they only read:

- every `archive_url` already in `data/` (records and manifests) and its schema fields
  (`archive_url`, `archived_sha256`, `archive_refused`); the site still links such copies;
- `reparse-bpk`, which re-converts texts from our archive.org copies and checks each against
  the recorded hash;
- the parser regression set's archive.org URLs (`pipeline/tests/regression.yaml`);
- `import-bpk.yml` still declares an `archive` input, ignored, so a run that started the next
  run with `-f archive=...` does not fail.

## Why

archive.org was slow, refused some files outright (UU 19/2003, UU 30/1947) and tied the
importer to credentials. The texts, not the PDFs, are what this project serves.

## Gave up

Laws imported from now on have no copy of the original PDF of our own; the source site (BPK)
and the Hugging Face mirror (`data/sources/mirrors/id_reg.json`) are the places to get it
again, checked against the recorded sha256. Supersedes the "keep every PDF" to-do and the
"every PDF is archived on archive.org" parts of decisions 0003 and the CLAUDE.md notes.
