# 0020 Search in the browser, from static files

Date: 2026-11-26 · Decided by: the operator; change by Claude

## What

`/cari/` is a prerendered page like every other (decision 0019). With JavaScript it searches in
the browser as you type and the Worker sees no search request.

- **Quick results.** The browser reads the law catalog of the release baked into the build
  (`import.meta.env.CORPUS_RELEASE`) from `/data/<release>/law-catalog.json`, parses it with the
  schema in `lib/catalog-record.ts` and runs `searchMatches` (`lib/search-matches.ts`), the same
  function the server used: citation lookup ("UU 11/2020"), "pasal 27 ITE" and title words. It
  runs on every keystroke and shows its groups at once.
- **Full text.** Pagefind runs in the browser as before, a pause after the last keystroke, and
  streams its pages in below the quick groups one batch at a time (`components/full-text-search.tsx`).
  A slow full-text search never delays the quick answer.
- **Address.** The query stays in `?q=` (replaced, not pushed, after a pause or on submit). A
  visit to `/cari/?q=x` gets the static shell, because an asset matches on the path alone; the
  page reads the query after hydration (`useHydrated`) and searches. The server never renders
  this page with a query, so the shell and the first client render match.
- **Static files.** The pipeline writes the catalog to `web-solid/public/data/<release>/law-catalog.json`
  and the Pagefind index to `web-solid/public/search-index/<release>/` (`export-corpus --public`,
  `corpus/public.py`, which also removes every other release folder there). Vite's own public
  folder copy puts them in `dist/client` and serves them in dev, and `pnpm run start` serves
  `dist/client`, so no plugin or middleware is involved. The committed `public/_headers` makes both
  immutable. Cloudflare serves them without the Worker. The R2 release no longer needs
  `pagefind/` (nothing reads it from the bucket), so `upload-release.sh` leaves it out; the
  catalog stays in R2 for the no-JavaScript `/cari/hasil/`.
- **Prefetch.** Focus on a search field (header, home, `/cari/`) and a hover or focus of a link to
  `/cari/` (the route preload) load the catalog and start Pagefind (`prefetchSearch`,
  `lib/search-data.ts`), once.
- **Without JavaScript.** Every search form posts to `/cari/hasil/` (a GET form). That route is
  not prerendered (`staticPagePath` refuses it) and no asset shadows it, so the Worker renders
  the grouped catalog results there with the same `searchMatches`, as before; full text needs
  JavaScript. With JavaScript the header and home forms and the example links go to `/cari/?q=`
  without a request; a direct visit to `/cari/hasil/?q=` hydrates and replaces its address by
  `/cari/?q=`.

## Why

An uncached search render on the Worker measured 7 to 10 ms of CPU, the empty shell 5 to 7 ms
(local `wrangler dev`, inspector Profiler; the numbers on Cloudflare are higher, 12 to 18 ms
for results), against a 10 ms limit on the free plan. A page that costs nothing on the Worker
cannot fail with error 1102, and typing no longer waits for a round trip.

## What we gave up

- About 2,500 more files in the deploy (the Pagefind index), so a version holds about 6,900 of
  the 20,000 the free plan allows, and the corpus can grow about three times before that binds
  (it was four).
- The no-JavaScript results page still costs about 10 ms of CPU on the Worker. It is only for
  readers without JavaScript and for a direct visit to `/cari/hasil/`.
- A search of a release newer than the build needs a deploy, as every page does (decision 0019).
- `/cari/laws.json` is gone. The catalog is the file of its release.
