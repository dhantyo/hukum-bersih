# Plan: the pipeline writes the corpus

Status: proposed 2026-11-25, waiting for the operator's go. Nothing here is built yet.

## What changes

`hukum-bersih export-corpus <dir>` (Python, in `pipeline/`) writes the whole web corpus from `data/`: law, collection and draft JSON, the comparison records, the catalog and listings, and the Pagefind index. Its output is a release directory that `web-solid` reads directly in dev (`HUKUM_CORPUS_DIR`) and that CI uploads to R2 unchanged. The TypeScript export scripts in `web-solid/scripts/` are deleted, and `web-solid` stops importing Astro's `web/src/lib/` at build and request time. `route-snapshot.sh` stays as the test tool.

The output is byte-identical to today's. The release id hashes every file in a release, so the proof for every PR is the same check: the Python export gives the same release id as the TypeScript export at that PR's base.

Settled by running before writing this plan (2026-11-25):

- Pagefind has an official Python package at 1.6.0, the same version as the JavaScript one, with `add_custom_record` and `write_files`.
- Word diffs match. Python `diff-match-patch` (20241021) and `@sanity/diff-match-patch` produced identical output on 400 changed paragraph pairs from the two drafts of RUU Perampasan Aset, using the same token encoding as `web/src/lib/compare.ts`.

## PRs in landing order

```
P1 harness ──► P2 laws ──► P3 collections ──► P4 drafts ──► P5 catalog+listings ──► P6 search ──► P7 release+CI ──► P8 delete TS exports
                                   └──────────────► P9 precompute collection comparisons (after uisdk merges)
```

Every PR branches from the previous one's merge into `feat/solid-reader`, so they land in order. Only P9 also waits for the `uisdk` branch, because it edits the collection pages that branch is changing.

### P1 Harness and output layout

- [ ] Depends on: nothing.
- [ ] Files: `pipeline/src/hukum_bersih/corpus/__init__.py`, `corpus/write.py`, `cli.py`, `pyproject.toml`; `pipeline/tests/test_corpus_write.py`.
- [ ] Builds: the `export-corpus` command skeleton and one JSON writer whose bytes match `JSON.stringify` (key order, `ensure_ascii=False`, no spaces, the same number formatting), plus a `compare-release` script that diffs two stage directories file by file.
- [ ] Result: `export-corpus` writes an empty stage, and `compare-release` reports differences per file.
- [ ] Verification: a unit test round-trips the JavaScript-written JSON of every current release file through the writer, and the bytes are equal.

### P2 Laws

- [ ] Depends on: P1.
- [ ] Files: `corpus/laws.py` (the law record, reader text, amendments and versions), the corresponding tests.
- [ ] Builds: the port of `export-laws.ts` with the parts of `peraturan.ts`, `lawdoc.ts`, `amendments.ts`, `versions.ts`, `display.ts`, `lawtext.ts` and `article-anchors.ts` it uses. The reader tree comes from the pipeline's own document model, not by parsing its XML back.
- [ ] Result: `laws/**/index.json` for all 1,930 laws.
- [ ] Verification: `compare-release` shows 0 differing files under `laws/` against the TypeScript export.

### P3 Collections

- [ ] Depends on: P2.
- [ ] Files: `corpus/collections.py`, plus the timeline and merge ports (`koleksi.ts`, `merge.ts`, `collection-timeline.ts`), with tests.
- [ ] Result: `collections/**`.
- [ ] Verification: 0 differing files under `collections/`.

### P4 Drafts and draft comparisons

- [ ] Depends on: P2.
- [ ] Files: `corpus/drafts.py`, `corpus/compare.py` (the port of `compare.ts`, with Python `diff-match-patch`), with tests. The test reuses the 400-pair fixture.
- [ ] Result: `drafts/**`, including `comparisons/`.
- [ ] Verification: 0 differing files under `drafts/`.

### P5 Catalog and listings

- [ ] Depends on: P2, P3 and P4.
- [ ] Files: `corpus/catalog.py` (`search-catalog.ts`, `law-listings.ts`, `labels.ts`), with tests.
- [ ] Verification: 0 differing files for `law-catalog.json` and `listings/`.

### P6 Search index

- [ ] Depends on: P2 and P4.
- [ ] Files: `corpus/search.py` (the port of `search-records.ts` and `index-corpus.ts`, using the Python `pagefind` package), with tests.
- [ ] Verification: 0 differing files under `pagefind/`. If Pagefind's output carries something non-deterministic, the PR proves equal search results for the 12 queries from the Pagefind cleanup instead, and says why.

### P7 Release, dev mode and CI

- [ ] Depends on: P1 to P6.
- [ ] Files: `corpus/release.py`, `cli.py`, `.github/workflows/solid-preview.yml`, `web-solid/README.md`.
- [ ] Builds: `hukum-bersih release publish|activate <corpus-dir>`. It writes `releases/<id>/`, the ready marker and the `active-release` pointer: the layout `web-solid` reads in dev, and the layout CI copies to R2 with rclone before switching the pointer. The preview workflow calls the pipeline instead of `pnpm run export-corpus`.
- [ ] Result: one Python command turns `data/` into a corpus that `pnpm run dev` reads.
- [ ] Verification: the same release id as the TypeScript `corpus-release`; `route-snapshot.sh` against the Python corpus gives 0 differing responses; publish then activate the previous id, and the pages follow (local; R2 waits for the preview secrets).

### P8 Delete the TypeScript exports

- [ ] Depends on: P7.
- [ ] Files: `web-solid/scripts/*` except `route-snapshot.sh`, the `export-corpus` and `corpus-release` package scripts, the `scripts/astro-data.ts` bridge, and docs (`web-solid/AGENTS.md`, `docs/ARCHITECTURE.md`, the handover).
- [ ] Verification: `pnpm run check`, `tsc`, `test` and `build` pass, and nothing under `web-solid/` imports `web/src/lib/` except the runtime imports P9 removes.

### P9 Precompute collection comparisons and drop the runtime Astro imports

- [ ] Depends on: P3 and P8, and the merged `uisdk` branch.
- [ ] Files: `corpus/collections.py`, `web-solid/src/lib/collection-compare.ts`, `src/server/records/`, and the components that import `labels.ts`, `display.ts`, `compare.ts`, `lawdoc.ts`, `lawtext.ts`, `merge.ts` and `search-query.ts`.
- [ ] Builds: the comparison for every version pair of each collection (at most 6) is written at export, so no diff runs per request. Labels and display helpers move into `web-solid/src/lib` or into the records.
- [ ] Verification: `route-snapshot.sh` shows 0 differing responses; no `web/src/lib` import remains in `web-solid/`; and `diff-match-patch` is gone from the server bundle.

## Review gates

- No PR changes an interaction, so none waits for a UI review. Each lands on its release-id or snapshot check.
- P7 changes CI. Its preview run waits for the three preview secrets.

## Not proven yet

- Whether the pipeline's own document model gives the reader tree directly, or P2 has to parse the generated XML the way `lawdoc.ts` does. P2 starts by checking that.
- Whether Pagefind's Python and JavaScript runtimes write identical index bytes (P6).
- Running time of the full export in Python against about 1.5 minutes today. Each PR reports it.
- Astro keeps its own TypeScript copy of this logic as the rollback path until cutover. The Python port can drift from it in that time. The release-id check catches drift only while both exports exist, up to P8.
