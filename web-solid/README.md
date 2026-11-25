# Hukum Bersih · Solid preview

The Solid 2 rewrite serves law pages on demand. Public law data and Pagefind assets come from the same corpus release.

## Run locally

Use the Node.js version in `.node-version` and the pnpm version in `package.json`. From this directory run `pnpm install --frozen-lockfile` and `pnpm run build`. The first build downloads the web fonts from fontsource and caches them in `node_modules/.cache/fontless`, so it needs network access. The export reads the generated Akoma Ntoso and the dependencies of the sibling Astro project, so build the Akoma Ntoso corpus and install the Astro dependencies first.

```sh
stage="$(mktemp -d)"
pnpm run export-corpus "$stage"

export HUKUM_CORPUS_DIR="$(mktemp -d)"
pnpm run corpus-release publish "$stage"
pnpm run start
```

`export-corpus` writes the whole corpus into the staging directory, in this order: the laws (`laws/`), the collections (`collections/`: the consolidated texts, `perubahan.json`, version comparisons and the timeline of a collection with no merged text), the drafts (`drafts/`: timelines, documents and the comparison of every pair of versions that have text), the catalog (`law-catalog.json` and the `listings/` rows for the home page, `/uu/`, `/uu/tahun/` and `/ruu/`), and last the Pagefind index (`pagefind/`). The index step renders pages with the built server, so run `pnpm run build` first. Use a new staging directory: the command does not replace an existing `laws/`.

Open `http://localhost:3000/uu/11/2008/` for the reader and `http://localhost:3000/cari/` for full-text search. To switch to an earlier published release, run `pnpm run corpus-release activate <release-id>` with the same corpus directory.

Run `pnpm run check`, `pnpm exec tsc --noEmit`, and `pnpm run test --run` to check the preview code.

To prove a refactor changed no output, build, then run `CORPUS=.snapshots/before-corpus scripts/route-snapshot.sh .snapshots/before`. The first run exports and publishes the corpus into that directory and prints its release id. Make the change, rebuild, run `CORPUS=.snapshots/before-corpus scripts/route-snapshot.sh .snapshots/after`, and run `diff -r .snapshots/before .snapshots/after`. The release id hashes every released file, so an unchanged id after re-exporting means the export is unchanged. The script header lists the few bytes it normalises. The `.snapshots/` folder is ignored by git.

## Cloudflare preview

The manual **Deploy Solid preview** workflow builds the Worker and publishes the full corpus with `export-corpus`: every law, the collections, the draft bills and the search index. A subset would leave the draft and collection pages out, and `export-corpus` has no subset option. It targets the `hukum-bersih-solid-preview` Worker and R2 bucket.

Create the preview bucket and enable a `workers.dev` subdomain for the Cloudflare account. Configure the repository secrets `CLOUDFLARE_ACCOUNT_ID`, `SOLID_PREVIEW_WORKERS_API_TOKEN` for Worker deployment, and `SOLID_PREVIEW_R2_ACCESS_KEY_ID` and `SOLID_PREVIEW_R2_SECRET_ACCESS_KEY` for object access to the preview bucket. The workflow verifies the deployed article permalink, comparison permalink, a collection page, a draft page and the Pagefind index. Its summary records the preview URL and corpus release ID.
