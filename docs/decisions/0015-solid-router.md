# 0015 Solid Router and its `query`, no TanStack in `web-solid/`

Date: 2026-11-24 · Decided by: the operator; change by Claude

## What

`web-solid/` routes with `@solidjs/router` 2 and reads data through its `query`. Removed:
`@tanstack/solid-router`, `@tanstack/solid-query`, `@tanstack/router-plugin`, the generated route
tree, the per-request query client and the server render setup module that built a router for each
request.

- Routes are a config list in `src/router.tsx`. Pages are lazy `routes/*.tsx` files, each with a
  `preload` that calls the same `query` as the page.
- Each server function is wrapped once in `src/lib/queries.ts`.
- Pages render with `renderMode: 'async'`, so a visitor without JavaScript never sees a
  `<Loading>` fallback.
- A `trailingSlash` middleware redirects a path without a slash and without a file extension.
- Plain `<a>` links; the router intercepts them and preloads on hover, focus and touch.
- Conventions and the pitfalls found while porting are in `web/AGENTS.md` and the topic docs it lists in `web/docs/`.

## Why

- The corpus is immutable per release and the app has no writes. TanStack Query's cache
  policy (stale time, refetch on focus, invalidation after a mutation) has nothing to manage here.
- The router's `query` covers what the pages need: it dedupes calls within a request, shares one
  fetch between a link preload and the route that opens, and serves the back button from a short
  cache. A second cache, its client and its hydration payload were extra code for the same result.
- One router and one data layer from the same project as `solid-js` and the Vite plugin, instead of
  two libraries with their own Solid 2 adapters (release candidates at the time of writing).
- Pages are checked against the router's own dev diagnostics (`SILENT_HOLD`, `LONG_HOLD`).

## Gave up

- TanStack's generated, fully typed route tree and its `Link` component. `Router.paths` types
  route URLs but never adds the trailing slash; `slashed()` does.
- Query devtools, window-focus refetch, infinite queries and cache-level optimistic updates.
- Content links were full page loads before and are client navigations now. Same-origin
  anchors are all router links; in-page `#` links opt out with `target="_self"`.

## If this changes

- Single-flight mutations come built in (`formAction`, or a server function called directly): the
  response carries the revalidated route data. If a correction or release becomes an application
  action, use them; the preview workflow already serialises deploys.
- TanStack Query can return for one screen if live data needs it (a release progress panel, say).
  It does not need to own routing for that.
