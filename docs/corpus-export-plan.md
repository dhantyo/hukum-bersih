# Plan: the pipeline writes the corpus

Status: proposed 2026-11-25. P1 and P2 are built on `feat/corpus-export-laws`, P3 on `feat/corpus-export-collections`, P4 on `feat/corpus-export-drafts`, P5 on `feat/corpus-export-catalog`; the other PRs are not.

## What changes

`hukum-bersih export-corpus <dir>` (Python, in `pipeline/`) writes the whole web corpus from `data/`: law, collection and draft JSON, the comparison records, the catalog and listings, and the Pagefind index. Its output is a release directory that `web-solid` reads directly in dev (`HUKUM_CORPUS_DIR`) and that CI uploads to R2 unchanged. The TypeScript export scripts in `web-solid/scripts/` are deleted, and `web-solid` stops importing Astro's `web/src/lib/` at build and request time. `route-snapshot.sh` stays as the test tool.

The output is byte-identical to today's. The release id hashes every file in a release, so the proof for every PR is the same check: the Python export gives the same release id as the TypeScript export at that PR's base.

Settled by running before writing this plan (2026-11-25):

- Pagefind has an official Python package at 1.6.0, the same version as the JavaScript one, with `add_custom_record` and `write_files`.
- Word diffs match. Python `diff-match-patch` (20241021) and `@sanity/diff-match-patch` produced identical output on 400 changed paragraph pairs from the two drafts of RUU Perampasan Aset, using the same token encoding as `web/src/lib/compare.ts`.

- Diff engine (operator: use an existing fast native engine, not our own port). Measured 2026-11-25 on the same 400 pairs and token encoding: pure Python `diff-match-patch` 383 ms (400/400 identical to JavaScript); `rapidiff` 0.3.0 (Rust `similar` through PyO3, a prebuilt wheel on Python 3.14) Myers plus `diff-match-patch`'s semantic cleanup 61 ms (379/400 identical; of the 21 that differ, 9 have fewer fragments and changes, 11 have more, 1 the same); `rapidiff` without the cleanup 31 ms (4/400, fragmented); `similar-rs` 32 ms (4/400); `fast-diff-match-patch` (C++) 57 ms (397/400) but no wheel for Python 3.14, and `diff_match_patch-python` also fails to build. The export uses `rapidiff` Myers followed by the semantic cleanup. So comparison word diffs are not byte-identical to the TypeScript export. P4 and P9 prove that pairing, counts, anchors and every non-diff byte are identical, report how many diffs changed, and measure the total diff time.

## PRs in landing order

```
P1 harness ──► P2 laws ──► P3 collections ──► P4 drafts ──► P5 catalog+listings ──► P6 search ──► P7 release+CI ──► P8 delete TS exports
                                   └──────────────► P9 precompute law and collection comparisons
```

Every PR branches from the previous one's merge into `feat/solid-reader`, so they land in order. Only P9 also waits for the `uisdk` branch, because it edits the collection pages that branch is changing.

### P1 Harness and output layout

- [x] Depends on: nothing.
- [x] Files: `pipeline/src/hukum_bersih/corpus/__init__.py`, `corpus/write.py`, `cli.py`, `pyproject.toml` (unchanged: no dependency was needed); `pipeline/tests/test_corpus_write.py`. The compare tool is `pipeline/scripts/compare_corpus.py` (not named `compare-release`).
- [x] Builds: the `export-corpus` command skeleton and one JSON writer whose bytes match `JSON.stringify` (key order, `ensure_ascii=False`, no spaces, the same number formatting), plus a `compare-release` script that diffs two stage directories file by file.
- [x] Result: `export-corpus` writes an empty stage, and `compare-release` reports differences per file.
- [x] Verification: a unit test round-trips the JavaScript-written JSON through the writer, and the bytes are equal. Done: a node-written fixture (control characters, U+2028, astral text, integer-like keys, `undefined`) always runs; with `CORPUS_REFERENCE=<stage>` the test also round-trips all 1,930 `laws/**/index.json` files (2026-11-25: 1,930 equal).

### P2 Laws

- [x] Depends on: P1.
- [x] Files: `corpus/laws.py` (the law record), `reader_text.py`, `regulations.py`, `koleksi.py`, `versions.py`, `jstext.py`, `pipeline/tests/test_corpus_laws.py`, `test_corpus_jstext.py`. `amendments.split` and `akn.build.to_akn_tree` were split out of existing functions so the export reuses them.
- [x] Builds: the port of `export-laws.ts` with the parts of `peraturan.ts`, `lawdoc.ts`, `amendments.ts`, `versions.ts`, `display.ts`, `lawtext.ts` and `article-anchors.ts` it uses. The reader tree comes from the lxml element that `akn.build.to_akn_tree` makes from the stored Bluebell text, not from XML written to disk and parsed back. (The pipeline's `Block` model is not stored, so the Bluebell text is what the export starts from.)
- [x] Result: `laws/**/index.json` for all 1,930 laws.
- [x] Verification: `compare-release` shows 0 differing files under `laws/` against the TypeScript export. Done 2026-11-25: `compare_corpus.py <ts> <py> --under laws` gives 1930 identical, 0 differing, 0 missing, 0 extra. The Python export takes 57 s on 8 cores, including the Bluebell-to-tree step that `build-akn` does separately; the TypeScript `exportLaws` alone takes 22 s from pre-built XML.

### P3 Collections

- [x] Depends on: P2.
- [x] Files: `corpus/collection_export.py` (named so, not `collections.py`: a module with a standard library name shadows it for any script run from that folder), `merge.py` (`merge.ts`), `version_history.py` (`versionHistory` and `compareData` of `amendments.ts`), `timeline.py` (`collection-timeline.ts`), and the `koleksi.ts` and `versions.ts` parts P2 already had, with `tests/test_corpus_collections.py`. `export_laws` now takes the `Laws` that `export_corpus` builds once (loading the records takes 8 s), `HistoryEvent.order` came back, `Laws.readable_amendments` replaced two copies of the amendment loop, and `reader_text` split into `read_document` and `reader_text_of`.
- [x] Result: `collections/**` (174 files for 86 collections: 82 `latest.json`, 4 `timeline.json`, 60 `perubahan.json` and the dated versions), written after `laws/` by `export-corpus`.
- [x] Verification: done 2026-11-25. `compare_corpus.py <ts> <py> --under collections` gives 174 identical, 0 differing, 0 missing, 0 extra, and `--under laws` still gives 1930 identical. Collections need no word diff: `perubahan.json` is `compareData`, which keeps each pasal's lines per version and never calls `diffLines` (the word diffs are made per request by the comparison pages, which P9 moves into the export), so no placeholder was needed. Collections add 19 s to the export on 8 cores (the full `export-corpus` takes 72 s); 90 % of the serial run was the Bluebell parse of the 85 base texts, now read in worker processes (37 s before). Ordering: the only `localeCompare` that reaches a file under `collections/` is the pasal-number tie-break in `perubahan.json`; the 38 distinct suffixes in the corpus order the same as `Intl.Collator()` and `Intl.Collator("id")` on all 1,444 pairs, and so do the 86 collection names (6 named, 80 unnamed) and the dates (all ISO).

### P4 Drafts and draft comparisons

- [x] Depends on: P2.
- [x] Files: `corpus/drafts.py`, `corpus/compare.py` (the port of `compare.ts`; word diffs through `rapidiff` plus the semantic cleanup), `corpus/pasal.py` (`lawtext.ts` and the pasal part of `lawdoc.ts`), with tests. `write_json` gained `newline=False` (the TypeScript export wrote drafts without a final newline) and `akn.build.ruu_akn_args` was split out of `build_ruu`. The 400-pair fixture is `tests/fixtures/wordiff_perampasan_aset.json`: the output of `compare.ts`'s `wordDiff` (`@sanity/diff-match-patch`) for 400 changed paragraph pairs of the two drafts, and the test checks `rapidiff` against it.
- [x] Result: `drafts/**`, including `comparisons/`, written after `laws/` by `export-corpus`.
- [x] Verification: done 2026-11-25. `compare_corpus.py <ts> <py> --under drafts --word-diff-parts` gives 3 identical, 1 differing only in word-diff grouping, 0 differing, 0 missing, 0 extra, and `--under laws` still gives 1930 identical. The flag parses both comparison files and compares everything except how the word diffs group their parts: pairs, counts, renumber and move markers, weak flags, anchors, cross-references, and the old and new text each line's parts spell. Of the 68 changed lines of the one comparison (RUU Perampasan Aset, 2023 against 2026), 66 have the same parts as JavaScript and 2 have fewer parts. On the 400-pair fixture 375 are identical to JavaScript, and every one of the 400 spells both texts. Diff time inside the export: 12.5 ms in 96 `word_diff` calls, in a drafts export of 0.62 s; the full `export-corpus` takes 52 s on 8 cores.

### P5 Catalog and listings

- [x] Depends on: P2, P3 and P4.
- [x] Files: `corpus/catalog.py` (`export-catalog.ts`, `law-listings.ts`, `search-catalog.ts`, and `tanggal` of `labels.ts`), `tests/test_corpus_catalog.py`. `Koleksi` gained `title` and `aliases`, and `regulations.py` gained `source_host`; the short names, collections, amendment counts and draft loading are P2 to P4's. `export_corpus` calls it last, with the `Laws` it built once.
- [x] Result: `law-catalog.json` and `listings/` (`overview.json`, `years/<year>.json`, `drafts.json`), read from the `laws/` and `drafts/` the same run wrote, as the TypeScript export does.
- [x] Verification: done 2026-11-25. `compare_corpus.py <ts> <py> --under law-catalog.json --under listings` gives 85 identical (1 catalog, 84 listings), 0 differing, 0 missing, 0 extra; `--under laws` 1930 and `--under collections` 174 still identical, and `--under drafts --word-diff-parts` is unchanged (3 identical, 1 differing only in word-diff grouping). The catalog step takes 0.09 s (the 8 s that loading the records takes is shared with P2 and P3). Ordering: no `localeCompare` is new. The ones that reach these files are the collection names (6 named, 80 unnamed), the draft titles and the draft document dates, and all order the same under `Intl.Collator()`, `Intl.Collator("id")` and `localeCompare`; the laws sort by year and number, and the sources and decades by count and year, all numbers. `tanggal` matches `labels.ts` on 14 inputs including out-of-range months (JavaScript prints `undefined` and `NaN`, and so does the port). Ported as is: the amendment count `k` is the highest ordinal a law's title says ("perubahan kedua" with one known makes 2), and a collection member's role in the catalog names the ordinal in words only up to the tenth (`perubahan 12` after that, where `ordinal()` of the collection pages gives `ke-12`).

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

### P9 Precompute the law and collection comparisons and drop the runtime Astro imports

- [ ] Depends on: P3 and P8, (the `uisdk` branch it waited for merged on 2026-11-25).
- [ ] Files: `corpus/collection_export.py`, `corpus/laws.py`, `web-solid/src/lib/collection-compare.ts`, `web-solid/src/server/law-comparison.ts`, `src/server/records/`, and the components that import `labels.ts`, `display.ts`, `compare.ts`, `lawdoc.ts`, `lawtext.ts`, `merge.ts` and `search-query.ts`.
- [ ] Builds: the comparison for every version pair of each collection (at most 6) and of each amended law (the `?bandingkan=…&dari=…` page) is written at export, so no diff runs per request. Labels and display helpers move into `web-solid/src/lib` or into the records.
- [ ] Verification: `route-snapshot.sh` shows 0 differing responses; no `web/src/lib` import remains in `web-solid/`; and `diff-match-patch` is gone from the server bundle.

## Review gates

- No PR changes an interaction, so none waits for a UI review. Each lands on its release-id or snapshot check.
- P7 changes CI. Its preview run waits for the three preview secrets.

## Not proven yet

- Whether Pagefind's Python and JavaScript runtimes write identical index bytes (P6).
- Running time of the full export in Python against about 1.5 minutes today. Each PR reports it.
- Astro keeps its own TypeScript copy of this logic as the rollback path until cutover. The Python port can drift from it in that time. The release-id check catches drift only while both exports exist, up to P8.
