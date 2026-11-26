# 0018 Compare versions in the browser from the published pair files

Date: 2026-11-26 · Decided by: the operator; change by Claude

## What

A visit to a `?v=` address of a comparison is rendered on the server, as before (decision 0017):
a shared link and a visit without JavaScript show it. A change made on the page (pick, add,
remove, swap, drag, keys, a quick choice) no longer calls the server renderer. The browser
fetches the published pair files as static files, parses them with the same valibot schemas and
maps them with the same `lib/compare.ts`.

- **Files.** `/data/<release>/collections/<slug>/comparisons/index.json` and
  `<older>...<newer>.json`: the corpus objects of that release, streamed from R2 (or
  `HUKUM_CORPUS_DIR`) by `server/middleware/release-data.ts` with
  `Cache-Control: public, max-age=31536000, immutable` and a strong ETag (`304` on a match). The
  Worker never parses them. The path is checked against `comparisonFilePath` in
  `lib/schemas.ts` (release id, slug, version ids), so a request cannot name anything else in the
  corpus.
- **Release.** The server's comparison carries the `release` it read (`PublishedComparison`).
  The page notes the comparison it shows (`noteShown`, `lib/browser-comparison.ts`), which is
  how a hydrated page learns the release without a request. Until a comparison has been shown,
  and when a release has no index (a collection without a comparison, or a release that is no
  longer the active one), the server function answers, as before.
- **Mapping.** `selectColumns` and `neighbourPairs` in `lib/compare.ts` decide which pairs a
  request needs (older version first), for the server and for the browser alike.
  `lib/pair-records.ts` holds the schemas both parse with.
- **Cache.** Each file is fetched and parsed once per page. A failure is not kept.
- **Prefetch.** The router already preloads a link on hover, focus and touch, which runs the
  comparison query: the remove, swap, add and quick-choice links fetch their pairs before the
  click. The picker, a drag and the keys fetch on the change (one small file each).
- **Failure.** A pair that cannot be loaded leaves the comparison on screen, marked `failed`, with
  a message and "Coba lagi" (`components/comparison-failure.tsx`). A `404` for a pair
  forgets the release, so the retry asks the server and learns the active one.
- **Law page.** It reads its record (`getLaw(path)`) and its comparison
  (`collectionComparisonQuery(family slug, request)`, then `placeInText`) separately, so a change
  of versions never reads the law again.
- **Pipeline.** `corpus/version_comparison.py` writes only the older-to-newer pair files. Nothing
  read the newer-to-older ones: `server/comparison.ts` and the browser always ask for the older
  version first, and `comparisons/index.json` lists only the versions.

## Why

On the Cloudflare free plan the `/_server` call that rebuilt the rows often failed with error
1102 (CPU limit), and the comparison did not update until a reload. Streaming a file and mapping
it in the browser costs the Worker almost nothing. Measured 2026-11-26 in headless Chromium at 4x
CPU throttle: fetch, parse and mapping of the largest published pair take about 100 ms.

## What we gave up

- Diffs are still made by the pipeline, not in the browser: computing them in the browser was
  about four times slower and is not needed while the pairs exist.
- A browser that has the page open across a new release reads the old release's files until it
  reloads or a file is missing; the retry then reads the active one.
- The edge does not cache `/data/` responses itself (no Cache API use); the browser does.
