# Solid migration handover

Last checked: 2026-11-24. The Solid implementation was developed on branch `feat/solid-reader` and merged into `main` on 2026-11-26; the preview deploys from `main`. The rewrite is in progress. The Astro site remains the production rollback path.

## Goal

Rewrite the reader and publishing workflow in `web-solid/` with Solid 2. Preserve the existing public URLs and legal behavior while removing Astro's per-document deployment files. Keep `data/` and the Python pipeline as the source of truth. Reuse framework-independent legal logic when it is already correct. Rework the Solid app around pages prerendered at build ([decision 0019](decisions/0019-prerender-pages-at-build.md)) and a versioned corpus in object storage that search and the comparison files read.

The finished migration must preserve law, collection, and draft pages; article permalinks; source links; JSON endpoints; Asli and Modern views; amendment history and comparisons; draft provenance; and the distinction between an unknown law and a known law whose text is unavailable. Direct law visits must work without JavaScript.

Publish law and comparison data plus the matching Pagefind index as one corpus release. Activate a release only after every object is ready. Keep the previous release available for rollback. Superseded by decision 0019: this goal said a law data update must not require a frontend deployment and that adding laws must leave the frontend asset count effectively constant. Pages are now static assets, so a data update is an export, a build and a deploy in one workflow, and the asset count grows with the corpus (about 4,400 files of the 20,000 the free plan allows).

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

`web-solid/` uses Solid 2 through `@solidjs/vite-plugin`, `@solidjs/router` with its `query` ([decision 0015](decisions/0015-solid-router.md)), StyleX, and Oxlint. Route `preload` functions and pages share one `query` per server function. Every public page is rendered at build by `prerender-crawler` and served as a static asset (decision 0019); the Worker reads JSON from an active immutable corpus release in R2 only for search, the citation lookup, the comparison pair files and a page the crawl did not make. The release also carries Pagefind assets. `hukum-bersih release publish` (`pipeline/src/hukum_bersih/corpus/release.py`) stores a release, writes its ready marker, then switches `active-release`; `.github/scripts/upload-release.sh` does the same order against R2.

The current route files cover:

| Area | Solid routes in the current tree | Remaining parity work |
|---|---|---|
| Laws | `/uu/`, `/uu/tahun/:tahun`, `/uu/:nomor/:tahun` (reading settings, status and relations banners, versions, contents, facts, `?v=<id>,<id>` comparison) | Folding of BAB and Pasal, the hide/show and drawer behaviour of the side panel, and the drag-to-swap columns of the comparison are not ported. |
| Collections | `/koleksi/`, `/koleksi/:slug`, `/koleksi/:slug/:versi`, and `/koleksi/:slug/perubahan.json` | The comparison (`?v=<id>,<id>,...`, one chooser and one block shared with the law page, decision 0017) is in place. Still open: the contents panel and the comparison inside the text (see `CompareMode.astro`). Law and collection comparisons are precomputed by the pipeline (`corpus/version_comparison.py`) and read from `collections/<slug>/comparisons/`; `web-solid` runs no diff and imports nothing from `web/`. |
| Draft bills | `/ruu/`, `/ruu/:slug`, `/ruu/:slug/:doc`, and `/ruu/:slug/beda/:pair` | None known. Comparisons are computed by the pipeline (`corpus/drafts.py`, run by `hukum-bersih export-corpus`) and read from the active release. The word diffs group their parts differently from the old TypeScript export for the one stored comparison; the texts they spell are the same. |
| Search | `/cari/`, law catalog JSON, citation lookup, and Pagefind-backed full-text results | Verify search results open the exact article in the deployed preview. |
| Standalone | `/` | Add `/tentang/` and compare homepage behavior with Astro. |

These are source-tree observations, not proof of a deployed preview. The detailed route files are under `web-solid/src/routes/`. The matching Astro route list is under `web/src/pages/`.

## Remaining proof and follow-up

The manual Cloudflare workflow is `.github/workflows/solid-preview.yml`. It exports the full corpus with `uv run hukum-bersih export-corpus --publish` in `pipeline/`, the one command that runs every export, builds the search index and stores the release, builds `web-solid/` from that corpus (`HUKUM_CORPUS_DIR`, which also prerenders the pages into `dist/client`), then uploads the release with `.github/scripts/upload-release.sh` (rclone) and deploys the Worker with its assets. The Worker configuration is `web-solid/wrangler.jsonc`. The Astro Pages configuration and its external DNS note are in `web/wrangler.jsonc`. The workflow has not been verified by a successful remote run in this checkout. The last credential check found these preview secrets absent: `CLOUDFLARE_WORKERS_API_TOKEN`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY`. Do not copy credentials into this document or the repository.

Finish the missing route parity, then prove one amended law end to end. Verify preview access through the actual production hostname before planning cutover. Measure the dynamic routes (search, citation lookup, `/cari/laws.json`) on the deployed Worker and compare the observed CPU time with the current Cloudflare limit; a page is a static asset and runs no Worker code. A local render time does not establish Worker CPU usage. Keep Astro rollback intact until this evidence is complete.

## Checks and project references

Run these commands from `web-solid/`:

```sh
pnpm run check
pnpm exec tsc --noEmit
pnpm run test --run
pnpm run build
```

For the architecture and legal behavior, read [the repository architecture](ARCHITECTURE.md), the relevant [decision records](decisions/), and the Astro source. [`web-solid/README.md`](../web-solid/README.md) describes the local corpus export (pipeline to `HUKUM_CORPUS_DIR`) and preview setup.
