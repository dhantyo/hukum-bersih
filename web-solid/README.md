# Hukum Bersih · Solid preview

The Solid 2 rewrite serves law pages on demand. Public law data and Pagefind assets come from the same corpus release.

## Run locally

Use Node.js 24 and the pnpm version in `package.json`. From this directory run `pnpm install --frozen-lockfile` and `pnpm run build`. The export command reads the generated Akoma Ntoso and dependencies in the sibling Astro project. Build the Akoma Ntoso corpus and install the Astro dependencies before exporting.

```sh
stage="$(mktemp -d)"
mkdir -p "$stage/laws/uu/11/2008"
pnpm run export-law uu_11_2008 "$stage/laws/uu/11/2008/index.json"
pnpm run export-catalog "$stage"
pnpm run index-corpus "$stage"

export HUKUM_CORPUS_DIR="$(mktemp -d)"
pnpm run corpus-release publish "$stage"
pnpm run start
```

Open `http://localhost:3000/uu/11/2008/` for the reader and `http://localhost:3000/cari/` for full-text search. To switch to an earlier published release, run `pnpm run corpus-release activate <release-id>` with the same corpus directory.

To prepare all laws, create a fresh staging directory and run `pnpm run export-law --all "$stage"` before indexing. The exporter creates the `laws/` directory. An existing export in that directory is kept intact.

Run `pnpm run lint`, `pnpm exec tsc --noEmit`, and `pnpm run test --run` to check the preview code.

## Cloudflare preview

The manual **Deploy Solid preview** workflow builds the Worker and publishes three laws, including UU ITE and the larger UU 11/2020. It targets the `hukum-bersih-solid-preview` Worker and R2 bucket.

Create the preview bucket and enable a `workers.dev` subdomain for the Cloudflare account. Configure the repository secrets `CLOUDFLARE_ACCOUNT_ID`, `SOLID_PREVIEW_WORKERS_API_TOKEN` for Worker deployment, and `SOLID_PREVIEW_R2_ACCESS_KEY_ID` and `SOLID_PREVIEW_R2_SECRET_ACCESS_KEY` for object access to the preview bucket. The workflow verifies the deployed article permalink, comparison permalink, and Pagefind index. Its summary records the preview URL and corpus release ID.
