# Hukum Bersih · Solid preview

The Solid 2 rewrite serves law pages on demand. Public law data and Pagefind assets come from the same corpus release.

## Run locally

Use the Node.js version in `.node-version` and the pnpm version in `package.json`. From this directory run `pnpm install --frozen-lockfile`. The first build downloads the web fonts from fontsource and caches them in `node_modules/.cache/fontless`, so it needs network access. The app imports nothing from the Astro project in `../web`.

The corpus is not built here. The pipeline writes it from `data/`, in one command from `pipeline/`:

```sh
cd ../pipeline
uv run hukum-bersih export-corpus --publish ../web-solid/.corpus     # about 2 minutes
cd ../web-solid
HUKUM_CORPUS_DIR="$PWD/.corpus" pnpm run dev                          # or: pnpm run build && pnpm run start
```

`export-corpus` writes the whole corpus into a temporary stage, in this order: the laws (`laws/`), the collections (`collections/`, with `comparisons/` for every ordered pair of versions of an amended law), the drafts (`drafts/`, with the comparison of every pair of versions that have text), the catalog (`law-catalog.json` and the `listings/` rows for the home page, `/uu/`, `/uu/tahun/` and `/ruu/`), and last the Pagefind index (`pagefind/`). `--publish` then stores the stage as `releases/<id>/` in the corpus folder (`hukum-bersih release publish`) and points `active-release` at it; the stage is deleted. The release id is the SHA-256 of every file, so an unchanged corpus gives the same id and publishing it again changes nothing. `.corpus/` is ignored by git.

To keep the stage, give a folder as the first argument and publish it yourself:

```sh
uv run hukum-bersih export-corpus ../web-solid/.snapshots/stage
uv run hukum-bersih release publish ../web-solid/.snapshots/stage --corpus ../web-solid/.corpus
```

Open `http://localhost:3000/uu/11/2008/` for the reader and `http://localhost:3000/cari/` for full-text search. Publishing a new release makes it the active one. To go back to an earlier one, run `uv run hukum-bersih release activate <release-id> --corpus ../web-solid/.corpus` (`--corpus` defaults to `HUKUM_CORPUS_DIR`); the next request reads it.

Run `pnpm run check`, `pnpm exec tsc --noEmit`, and `pnpm run test --run` to check the preview code.

To prove a refactor changed no output, build, then run `CORPUS=.snapshots/before-corpus scripts/route-snapshot.sh .snapshots/before`. The first run has the pipeline export and publish the corpus into that directory (about two minutes) and prints its release id. Make the change, rebuild, run `CORPUS=.snapshots/before-corpus scripts/route-snapshot.sh .snapshots/after`, and run `diff -r .snapshots/before .snapshots/after`. The release id hashes every released file, so an unchanged id after re-exporting means the export is unchanged. The script header lists the few bytes it normalises. The `.snapshots/` folder is ignored by git.

## Visual parity against Astro

`pnpm run visual-parity` screenshots the same routes on the built Astro site and on this app, then writes a side-by-side image, a pixel diff and a mismatch percentage for each pair. Use it to see what still differs from `../web` and to prove a layout change moved a page closer.

```sh
pnpm run build                                                  # this app
ASTRO_DIST=/path/to/web/dist pnpm run visual-parity --run base   # Astro is served from an existing build, never rebuilt
pnpm run visual-parity --compare base after                      # lists how far each page moved between two runs
```

It serves `ASTRO_DIST` (default `../web/dist`) as static files and starts `dist/server/node.js` on the corpus in `CORPUS` (default `.snapshots/corpus`, written by `export-corpus --publish` as above). The browser is the Chromium that `playwright-core` installed in `~/.cache/ms-playwright` (`CHROMIUM_PATH` or `--chromium` picks another binary). Options: `--only <route ids>`, `--widths 1280,390`, `--jobs <n>`, `--run <name>`. `VISUAL_PARITY_PORT` sets the port of this app (default 3331); Astro is served 1000 above it, so two runs side by side need different values.

The route matrix is the `ROUTES` table in `scripts/visual-parity/routes.ts`: add a route with one line. Every route is shot at each width, light and dark, and law pages also in Asli and Modern. A page is cut at a fixed height (Chromium cannot capture taller), and a route marked `viewportOnly` keeps only the first screenful. Animations are off, fonts and network are idle and the page height is steady before a shot, so two runs on the same builds give the same percentages; `--compare` exits 1 when a page moved by more than 0.1 points. Output is `.snapshots/visual/<run>/index.html` (pages worst first), `summary.json` and the PNGs, all ignored by git.

## Cloudflare preview

The manual **Deploy Solid preview** workflow builds the Worker, runs `hukum-bersih export-corpus --publish` in `pipeline/` for the full corpus (every law, the collections, the draft bills and the search index), and uploads that release to R2 with rclone (`.github/scripts/upload-release.sh`): the release files, then its ready marker, then the `active-release` pointer, so a reader never sees a half-uploaded release. A subset would leave the draft and collection pages out, and `export-corpus` has no subset option. It deploys the `hukum-bersih-solid-preview` Worker, reading the `hukum-bersih-corpus` R2 bucket.

Create the R2 bucket `hukum-bersih-corpus` (the corpus releases, named for what it holds, not for this preview) and enable a `workers.dev` subdomain for the Cloudflare account. Configure the repository secrets `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_WORKERS_API_TOKEN` for Worker deployment, and `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` for object access to that bucket. The workflow verifies the deployed article permalink, comparison permalink, a collection page, a draft page and the Pagefind index. Its summary records the preview URL and corpus release ID.
