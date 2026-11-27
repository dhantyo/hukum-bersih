# Search

The browser search on `/cari/` and the no-JavaScript results page.
Source paths (`routes/`, `components/`, `lib/`, `styles/`, `server/`, `app.tsx`, `document.tsx`) are under `web/src/`; other paths are relative to `web/`.

## Search

`/cari/` is prerendered and searches in the browser (decision 0020): `routes/search.tsx` loads the catalog (`lib/search-data.ts`, schema in `lib/catalog-record.ts`), runs `searchMatches` on every keystroke and renders `FullTextSearch` below it, which pauses after the last key and streams Pagefind pages in. The query lives in a signal and in `?q=` (replaced after a pause), and is read from the address only after hydration (`useHydrated`), because the shell is the same HTML for every query. Every search form posts to `PLAIN_SEARCH_PATH` (`/cari/hasil/`, `routes/search-plain.tsx`, the Worker renders the catalog results) and takes `useSearchSubmit` (or the page's own handler) so that, with JavaScript, a submit goes to `/cari/?q=` with no request; a link to a search is `plainSearchUrl(...)` with an `onClick` that navigates to `searchUrl(...)`. A search field calls `prefetchSearch` on focus. The catalog and the index are written into `public/data/<release>/` and `public/search-index/<release>/` by `export-corpus --public` (git-ignored; `public/_headers` is committed), so Vite ships them in the build and serves them in dev; the matching code in `lib/search-matches.ts` is the one implementation, used by the browser and by `/cari/hasil/`.
