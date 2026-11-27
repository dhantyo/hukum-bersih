# Routes and links

How a page is added, reads its data and links to others.
Source paths (`routes/`, `components/`, `lib/`, `styles/`, `server/`, `app.tsx`, `document.tsx`) are under `web/src/`; other paths are relative to `web/`.

## Routes

`router.tsx` lists every route as `defineRoute({ path, component: lazy(...), preload })`; a more specific pattern goes before a general one (`/uu/tahun/:tahun` before `/uu/:nomor/:tahun`). A page is one file in `routes/` with a default-exported arrow const typed `RouteProps<"/pattern">`. It reads data with `createMemo(async () => await xQuery(...))` and shows a missing record with `<Show when={record()} fallback={<NotFound />} keyed>`; `NotFound` sets the 404 status. The preload calls the same query as the page, so the click, the hover and the first render share one request. Title: `<PageTitle>` from `components/page-title.tsx` (a `@solidjs/meta` `Title` with the site suffix), description: `<Meta name="description" ...>`, both rendered inside the page. Search indexing is decided by the pipeline's `corpus/search.py` from the exported records, not by the page or a robots meta. UI longer than a page goes in `components/`. Example: `routes/collection.tsx`.

## Search params

Declare a valibot schema in `lib/schemas.ts`, set it as the route's `search`, and parse `props.location.query` with `v.parse(schema, ...)` in the page and in its preload. A schema never throws: use `v.fallback` for a value the page can ignore.

## Links

Plain `<a>`: the router handles every same-origin anchor, preloads on hover, focus and touch, and marks the current one. Public URLs end in a slash and `Router.paths` never adds one, so build route links with `slashed(Router.paths...)` from `lib/paths.ts`; URLs that come from a record are used as stored. An in-page `#` link carries `target="_self"` so the router leaves it alone and does not mark it as the current page. A GET `<form>` is submitted by the browser, not the router.

## Pending state

A navigation holds the old screen until the new one is ready, and dev reports `SILENT_HOLD` when nothing on screen says so. `app.tsx` shows one status line from `isPending(() => props.children)` for every route; a new page needs nothing of its own.
