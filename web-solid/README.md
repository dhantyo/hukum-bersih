# Hukum Bersih · Solid preview

The Solid 2 rewrite serves law pages on demand. Public law data and Pagefind assets come from the same corpus release.

## Run locally

Use the Node.js version in `.node-version` and the pnpm version in `package.json`. From this directory run `pnpm install --frozen-lockfile`. The first build downloads the web fonts from Google Fonts and caches them in `node_modules/.cache/fontless`, so it needs network access. The app imports nothing from the Astro project in `../web`.

The corpus is not built here. The pipeline writes it from `data/`, in one command from `pipeline/`:

```sh
cd ../pipeline
uv run hukum-bersih export-corpus --publish ../web-solid/.corpus --public ../web-solid/public   # about 2 minutes
cd ../web-solid
HUKUM_CORPUS_DIR="$PWD/.corpus" pnpm run dev                          # or: pnpm run build && pnpm run start
```

`export-corpus` writes the whole corpus into a temporary stage, in this order: the laws (`laws/`), the collections (`collections/`, with `comparisons/` for every ordered pair of versions of an amended law), the drafts (`drafts/`, with the comparison of every pair of versions that have text), the catalog (`law-catalog.json` and the `listings/` rows for the home page, `/uu/`, `/uu/tahun/` and `/ruu/`), and last the Pagefind index (`pagefind/`). `--publish` then stores the stage as `releases/<id>/` in the corpus folder (`hukum-bersih release publish`) and points `active-release` at it; the stage is deleted. The release id is the SHA-256 of every file, so an unchanged corpus gives the same id and publishing it again changes nothing. `--public <dir>` then writes the active release's `law-catalog.json` to `<dir>/data/<release>/` and the Pagefind index to `<dir>/search-index/<release>/`, and removes the other release folders there; give it `../web-solid/public`, whose `data/` and `search-index/` Vite copies into the build and serves in dev (`public/_headers` is committed and makes both immutable on Cloudflare). `.corpus/` and those two folders are ignored by git. Run it before `pnpm run dev` or `pnpm run build`.

To keep the stage, give a folder as the first argument and publish it yourself:

```sh
uv run hukum-bersih export-corpus ../web-solid/.snapshots/stage
uv run hukum-bersih release publish ../web-solid/.snapshots/stage --corpus ../web-solid/.corpus
```

Open `http://localhost:3000/uu/11/2008/` for the reader and `http://localhost:3000/cari/` for search. Publishing a new release makes it the active one. To go back to an earlier one, run `uv run hukum-bersih release activate <release-id> --corpus ../web-solid/.corpus` (`--corpus` defaults to `HUKUM_CORPUS_DIR`); the next request reads it.

Run `pnpm run check`, `pnpm exec tsc --noEmit`, and `pnpm run test --run` to check the preview code.

To prove a refactor changed no output, build, then run `CORPUS=.snapshots/before-corpus scripts/route-snapshot.sh .snapshots/before`. The first run has the pipeline export and publish the corpus into that directory (about two minutes) and prints its release id. Make the change, rebuild, run `CORPUS=.snapshots/before-corpus scripts/route-snapshot.sh .snapshots/after`, and run `diff -r .snapshots/before .snapshots/after`. The release id hashes every released file, so an unchanged id after re-exporting means the export is unchanged. The script header lists the few bytes it normalises. The `.snapshots/` folder is ignored by git.

## Prerendered pages

`pnpm run build` also renders every public page, so it needs the corpus: set `HUKUM_CORPUS_DIR` to a directory written by `export-corpus --publish` (the same one `pnpm run dev` reads). `prerender-crawler` (see `vite.config.ts` and [decision 0019](../docs/decisions/0019-prerender-pages-at-build.md)) crawls the built server in process from the five index pages, follows every link, and writes each page to `dist/client/<path>/index.html` with the data calls it made in `dist/client/_static/`. `dist/prerender-report.json` lists every page, its timing and what linked to it. The build fails if a linked page does not render, except the `/perppu/<n>/<year>/` links, which have no route. The release id is baked into the client (`import.meta.env.CORPUS_RELEASE`) so a comparison built in the browser reads its pair files from the same release as the page.

`wrangler.jsonc` serves `dist/client` as assets and runs the Worker only for a path with no asset: `/cari/hasil/` (search without JavaScript), a call that was not baked and every 404. `/cari/`, the law catalog and the Pagefind index are assets, so search with JavaScript makes no Worker request ([decision 0020](../docs/decisions/0020-search-in-the-browser.md)). To try it locally, seed a local R2 with a release (a scratch script that puts the release files with `getPlatformProxy`) and run `pnpm exec wrangler dev --persist-to <dir>`; never `--remote`.

## Visual parity against Astro

`pnpm run visual-parity` screenshots the same routes on the built Astro site and on this app, then writes a side-by-side image, a pixel diff and a mismatch percentage for each pair. Use it to see what still differs from `../web` and to prove a layout change moved a page closer.

```sh
pnpm run build                                                  # this app
ASTRO_DIST=/path/to/web/dist pnpm run visual-parity --run base   # Astro is served from an existing build, never rebuilt
pnpm run visual-parity --compare base after                      # lists how far each page moved between two runs
```

It serves `ASTRO_DIST` (default `../web/dist`) as static files and starts `dist/server/node.js` on the corpus in `CORPUS` (default `.snapshots/corpus`, written by `export-corpus --publish` as above). The browser is the Chromium that `playwright-core` installed in `~/.cache/ms-playwright` (`CHROMIUM_PATH` or `--chromium` picks another binary). Options: `--only <route ids>`, `--widths 1280,390`, `--jobs <n>`, `--run <name>`. `VISUAL_PARITY_PORT` sets the port of this app (default 3331); Astro is served 1000 above it, so two runs side by side need different values.

The route matrix is the `ROUTES` table in `scripts/visual-parity/routes.ts`: add a route with one line. Every route is shot at each width, light and dark, and law pages also in Asli and Modern. A page is cut at a fixed height (Chromium cannot capture taller), and a route marked `viewportOnly` keeps only the first screenful. Animations are off, fonts and network are idle and the page height is steady before a shot, so two runs on the same builds give the same percentages; `--compare` exits 1 when a page moved by more than 0.1 points. Output is `.snapshots/visual/<run>/index.html` (pages worst first), `summary.json` and the PNGs, all ignored by git.

## Header reveal check

`node scripts/header-reveal.ts <url> --label <name>` opens the page in Chromium, scrolls down far, then up a little, and prints the header's `top`, `data-mode`, `position` and `transform` for every frame of the scroll up. It exits 1 when the header was ever below the top of the window while it came back (it must slide in from above), or when the header caused a layout shift. It works on this app and on the built Astro site, which is the reference (`--allow-header-shift` keeps Astro's own header shift, from moving `top`, from failing it). `--reduced` runs it under `prefers-reduced-motion: reduce`, `--width <px>` sets the window width, `--out <file>` saves the frames as JSON.

```sh
pnpm run build && pnpm run start     # then, in another shell:
node scripts/header-reveal.ts http://localhost:3000/uu/11/2008/ --label solid
```

## Cloudflare preview

The manual **Deploy Solid preview** workflow runs `hukum-bersih export-corpus --publish ... --public ../web-solid/public` in `pipeline/` for the full corpus (every law, the collections, the draft bills and the search index), builds the Worker from it, and uploads that release to R2 (without `pagefind/`, which only the static assets use) with rclone (`.github/scripts/upload-release.sh`): the release files, then its ready marker, then the `active-release` pointer, so a reader never sees a half-uploaded release. A subset would leave the draft and collection pages out, and `export-corpus` has no subset option. It deploys the `hukum-bersih-solid-preview` Worker, reading the `hukum-bersih-corpus` R2 bucket. After a successful deploy, `.github/scripts/prune-releases.sh` deletes every `releases/<id>/` folder except the new release and the one that `active-release` named before the upload (read by the publish step and passed on as a step output), so redeploying the previous Worker, which has its release id baked in, always finds its corpus. It deletes nothing when the previous release is unknown or equal to the new one, and `--dry-run` only lists what it would delete.

Create the R2 bucket `hukum-bersih-corpus` (the corpus releases, named for what it holds, not for this preview) and enable a `workers.dev` subdomain for the Cloudflare account. Configure the repository secrets `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_WORKERS_API_TOKEN` for Worker deployment, and `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` for object access to that bucket. The workflow verifies the deployed article permalink, comparison permalink, a collection page, a draft page and the Pagefind index. Its summary records the preview URL and corpus release ID.
