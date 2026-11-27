# Code layout

Where code goes and the shape each kind of file takes. Copy the named example when you add a new one of the same kind.
Source paths (`routes/`, `components/`, `lib/`, `styles/`, `server/`, `app.tsx`, `document.tsx`) are under `web/src/`; other paths are relative to `web/`.

## Layout

`src/` root holds only the app shell the Solid plugin finds by name (`app.tsx`, `document.tsx`), the router (`router.tsx`) and the request middleware (`middleware.ts`). Pages are in `routes/`, UI in `components/`, styles in `styles/`. `lib/` is code the browser can import (server functions, queries, schemas, search matching). `server/` is server only: `corpus.ts`, `records/`, `middleware/`.

## Published records

One file per JSON object in `server/records/`: a valibot schema, an inferred type, and a read function that fetches the active-release text and parses it with `parseRecord`. Nothing else parses published JSON. Example: `server/records/law.ts`. Reader text is checked without being rebuilt (`records/reader-text.ts`), so large laws are not copied.

## Ids, paths and links

Define each once in `lib/schemas.ts` and reuse it with `v.is` or inside a record. Never write the pattern again in a route or middleware.

## Server functions

In `lib/`, `GET(async (...) => { "use server"; ... })`. Check every argument against a `lib/schemas.ts` schema, return `null` (or `[]` for a list) when it fails, then call one reader from `server/records/`. Example: `lib/collections.ts`. A function a crawled page reads is `prerendered(async (...) => { "use server"; ... })` from `@solidjs/prerender` instead of `GET` (decision 0019): the build bakes its calls into `_static/` so a client navigation reads a file; only the no-JavaScript search (`/cari/hasil/`) stays `GET`.

## Queries

Wrap each server function once, in `lib/queries.ts`, as `query(fn, "key")`. Never pass a trailing `undefined` argument: arguments travel as JSON and it throws (see `fetchReader`). The router's `query` dedupes within a request and for a few seconds in the browser; there is no query client.

## Components

One arrow const per component with its props typed inline, in a kebab-case file. Test text for presence with `isPresent`, never as a truthy string. Components import record types, never record readers. No `data-pagefind-*` attribute anywhere: `components/full-text-search.tsx` and `lib/pagefind.ts` are the only code that know Pagefind, and the pipeline builds the index from the exported records (`corpus/search.py`), not from the markup.
