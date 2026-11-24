# Solid migration handover

Last checked: 2026-11-24. The Solid implementation checkpoint is `8431e778` on branch `feat/solid-reader`. The rewrite is in progress. The Astro site remains the production rollback path.

## Goal

Rewrite the reader and publishing workflow in `web-solid/` with Solid 2. Preserve the existing public URLs and legal behavior while removing Astro's per-document deployment files. Keep `data/` and the Python pipeline as the source of truth. Reuse framework-independent legal logic when it is already correct. Rework the Solid app around on-demand SSR and a versioned corpus in object storage.

The finished migration must preserve law, collection, and draft pages; article permalinks; source links; JSON endpoints; Asli and Modern views; amendment history and comparisons; draft provenance; and the distinction between an unknown law and a known law whose text is unavailable. Direct law visits must work without JavaScript.

Publish law and comparison data plus the matching Pagefind index as one corpus release. Activate a release only after every object is ready. Keep the previous release available for rollback. A law data update must not require a frontend deployment, and adding laws must leave the frontend asset count effectively constant.

Before cutover, prove the path on a Cloudflare preview. Verify the production hostname despite its externally managed DNS, an article permalink, Asli and Modern display, comparisons, and a full-text result that opens the right article. Publish and roll back a correction without a frontend deployment. Measure uncached CPU on a large law against the actual hosting limit. Check the browser bundle before deciding whether Solid server components solve a measured problem. Keep Astro deployable until the preview and cutover are proven.

## Work rules

- Read the root `AGENTS.md` and `web-solid/AGENTS.md` before changing code. Read `web/AGENTS.md` when checking Astro behavior.
- Use `pnpm` only inside `web-solid/`. The package declares `pnpm@10.34.9`. Do not change the pnpm store configuration or location.
- Apply `clean-code-guard` to each implementation slice. Run the relevant checks and verify the normal route or publishing path before expanding the rewrite.
- Commit each completed slice with a Conventional Commit. Stage named files only. Do not use `git add -A`.
- The cleanup request applies to old CLI boilerplate inside `web-solid/`. Keep the Astro app and its deploy workflow for rollback until cutover is verified.
- The Solid reader currently has no user-facing write operation. The user is open to single-flight mutations where useful. Do not add a placeholder mutation. Reassess single-flight if a correction or release operation becomes an application action. The current release script updates the active-release pointer, and the preview workflow serializes deployments with a concurrency group.

The shared checkout has unrelated, uncommitted agent-file changes and a local `.wrangler/` directory. Preserve them. Check `git status --short` before staging and include only the files for the current slice.

## Current implementation

`web-solid/` uses Solid 2 through `@solidjs/vite-plugin`, `@solidjs/router` with its `query` ([decision 0015](decisions/0015-solid-router.md)), StyleX, and Oxlint. Route `preload` functions and pages share one `query` per server function. The runtime reads JSON from an active immutable corpus release in R2, renders document routes on demand, and caches public HTML. The release also carries Pagefind assets. `web-solid/scripts/corpus-release.ts` publishes a release, writes its ready marker, then switches `active-release`.

The current route files cover:

| Area | Solid routes in the current tree | Remaining parity work |
|---|---|---|
| Laws | `/uu/`, `/uu/tahun/:tahun`, `/uu/:nomor/:tahun`, and a comparison for one amendment step | Verify Asli and Modern controls against Astro. The route selects the latest step or one named step. A two-version comparison using `dari` is currently unavailable. |
| Collections | `/koleksi/`, `/koleksi/:slug`, `/koleksi/:slug/:versi`, and `/koleksi/:slug/perubahan.json` | Restore a user-facing version comparison flow and verify all links and notes. |
| Draft bills | `/ruu/`, `/ruu/:slug`, and `/ruu/:slug/:doc` | Add `/ruu/:slug/beda/:pair` draft comparisons. |
| Search | `/cari/`, law catalog JSON, citation lookup, and Pagefind-backed full-text results | Verify search results open the exact article in the deployed preview. |
| Standalone | `/` | Add `/tentang/` and compare homepage behavior with Astro. |

These are source-tree observations, not proof of a deployed preview. The detailed route files are under `web-solid/src/routes/`. The matching Astro route list is under `web/src/pages/`.

## Next slice: draft comparisons

Implement the missing `/ruu/<slug>/beda/<older-id>...<newer-id>/` route. The Astro reference is `web/src/pages/ruu/[slug]/beda/[pair].astro`, with row rendering in `web/src/components/SynRow.astro` and matching logic in `web/src/lib/compare.ts`.

Before changing the route, inspect those files and record representative output from the current Astro site. Preserve the version names, dates, provenance, change counts, matched and unmatched pasal, renumbered and moved markers, word-level changes, low-similarity notes, cross-references, and row anchors. Preserve links from each comparison back to its source draft document.

Keep comparison computation out of request-time UI code if it can be generated during corpus export. Validate stored comparison records at the read boundary. Include the comparison files in the same release as their draft documents. Then add the Solid route and verify direct SSR requests, known and unknown pairs, article anchors, counts, and the same-row toggle. Test release activation and rollback with the comparison data present.

Commit this slice separately, for example `feat(web-solid): restore draft comparisons`.

## Remaining proof and follow-up

The manual Cloudflare workflow is `.github/workflows/solid-preview.yml`. The Worker configuration is `web-solid/wrangler.jsonc`. The Astro Pages configuration and its external DNS note are in `web/wrangler.jsonc`. The workflow has not been verified by a successful remote run in this checkout. The last credential check found these preview secrets absent: `SOLID_PREVIEW_WORKERS_API_TOKEN`, `SOLID_PREVIEW_R2_ACCESS_KEY_ID`, and `SOLID_PREVIEW_R2_SECRET_ACCESS_KEY`. Do not copy credentials into this document or the repository.

After draft comparisons, finish the missing route parity, then prove one amended law end to end. Verify preview access through the actual production hostname before planning cutover. Measure a large law on the deployed Worker and compare the observed CPU time with the current Cloudflare limit. A local render time does not establish Worker CPU usage. Keep Astro rollback intact until this evidence is complete.

## Checks and project references

Run these commands from `web-solid/`:

```sh
pnpm run check
pnpm exec tsc --noEmit
pnpm run test --run
pnpm run build
```

For the architecture and legal behavior, read [the repository architecture](ARCHITECTURE.md), the relevant [decision records](decisions/), and the Astro source. [`web-solid/README.md`](../web-solid/README.md) describes local corpus export and preview setup. Its `pnpm run lint` instruction is stale: `web-solid/package.json` defines `check`, not `lint`.
