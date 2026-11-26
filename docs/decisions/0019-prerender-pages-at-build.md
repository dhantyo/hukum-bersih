# 0019 Prerender every public page at build and serve it as a static asset

Date: 2026-11-26 · Decided by: the operator; change by Claude

## What

`web-solid/` renders every public page once, at build, and ships the HTML as Worker static
assets. Cloudflare serves a page from the assets without running the Worker. This reverses the
goal in `docs/solid-migration-handover.md` that a data update must not need a frontend deploy:
a correction to a law now means export the corpus, rebuild and deploy, all in the preview
workflow.

- **Crawl.** `prerender-crawler` (Solid's official build-time crawler, `prerender-crawler/vite`
  in `vite.config.ts`) runs after the client and server builds, in `hybrid` mode with
  `emitPages: true`, in-process against the built server, reading the corpus in
  `HUKUM_CORPUS_DIR`. Seeds are the five index pages; every other page is found by its links.
  `filter` keeps only paths `staticPagePath` (`lib/schemas.ts`) accepts, so `/cari/hasil/` and
  the JSON endpoints are never written. The build fails when a linked page does not render, except
  the `/perppu/<n>/<year>/` links, which have no route today (404, a gap the base already has).
- **Server function results.** The data functions of the law, collection and draft pages are
  `prerendered()` (`@solidjs/prerender`). The crawl bakes each call a page made into
  `_static/<build>/*.txt`; in hybrid mode a client navigation fetches that file as an asset and
  falls back to the Worker only for a call the crawl did not make. Without it a click to a large
  law called `/_server` and hit the CPU limit again.
- **`?v=`.** An asset matches on the path alone, so a direct visit to a comparison address gets
  the plain page. After hydration the browser builds the comparison from the published pair
  files (`lib/after-hydration.ts`, decision 0018). The release it reads from is baked into the
  build (`import.meta.env.CORPUS_RELEASE`, from `active-release` of `HUKUM_CORPUS_DIR`), so the
  page and its pair files are of one release. The preview workflow keeps only the new release and
  the previous one in the bucket (`.github/scripts/prune-releases.sh`), enough to roll back by
  redeploying the previous Worker. Hydration renders the plain page first, so it
  matches the HTML.
- **Worker.** `wrangler.jsonc` keeps `run_worker_first: false`: a request that matches an asset
  never runs the Worker, with or without a query string. What has no asset reaches the Worker:
  `/cari/hasil/` (the search without JavaScript), `/data/<release>/...` of a comparison file,
  `/_server` for a call that was not baked and every 404 (decision 0020 moved `/cari/`, the
  catalog and the search index to assets).
  `@solidjs/prerender` is aliased to its server build in the Worker bundle, because wrangler
  resolves the package's `browser` entry and fails at start.
- **Search CPU.** The catalog is parsed once per isolate for each active release
  (`server/records/catalog.ts`) and the search text is tokenised once (`lib/search-matches.ts`).

## Why

The Cloudflare free plan allows 10 ms of CPU per request. An uncached render of
`/uu/11/2020/` measured about 1074 ms, so every first visit to a large law failed with error
1102. Rendering at build moves that cost to CI. Limits checked on 2026-11-26 in the Cloudflare
docs: 20,000 asset files per Worker version on the free plan, 25 MiB per file, no total size
limit. The build writes about 4,400 files (2,134 pages and 2,133 baked calls), 728 MB, the
largest 7.87 MB.

## What we gave up

- A data fix needs a rebuild and a deploy. The Worker no longer reads a new release for a page;
  the pages show the release that was built. The R2 corpus is still needed by search, the
  pair files and the baked release.
- Every deploy uploads the changed assets (the page hash decides), and the free plan caps a
  version at 20,000 files: the corpus can grow about four times before that binds.
- Build time grows with the corpus (about one minute for 2,135 pages on a laptop).
- Search results were still rendered by the Worker, which can cross the CPU limit; decision 0020
  moves them to the browser.
- `server/middleware/public-law-cache.ts` rarely runs now (an asset answers first).
