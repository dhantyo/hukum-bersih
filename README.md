# Hukum Bersih

Situs terbuka untuk hukum Indonesia: teks peraturan yang bersih dan mudah dicari, pelacakan RUU beserta setiap versi drafnya, dan perbandingan perubahan antarversi.

An open, layman-friendly tracker for Indonesian law: clean searchable text, RUU (draft bill) tracking with every draft version and its provenance, and diffs between versions.

## Layout

| Path | What | License |
|---|---|---|
| `data/` | Law and RUU text as Markdown + YAML, source manifests. **Source of truth.** No PDFs. | [CC0 1.0](data/LICENSE) |
| `scraper/` | Python scraper and PDF → Markdown parser | [AGPL-3.0](LICENSE) |
| `web/` | Astro static site + Pagefind search | [AGPL-3.0](LICENSE) |
| `docs/` | Project brief and design notes | AGPL-3.0 |

Data layout (see `docs/BRIEF.md` §6):

```
data/
  peraturan/uu/<year>/uu-<n>-<year>.md
  ruu/<slug>/ruu.yaml
  ruu/<slug>/versions/<date>-<label>.md
  sources/manifests/
```

## Development

Scraper (Python ≥ 3.12, [uv](https://docs.astral.sh/uv/)):

```bash
cd scraper && uv sync && uv run pytest
```

Website (deployed to Cloudflare Pages by `.github/workflows/deploy.yml`; Node ≥ 22.23.4):

```bash
cd web && npm ci && npm run build
```

## Ground rules

- PDFs never go into git; they are archived on the Internet Archive and referenced by URL + sha256.
- Every document carries provenance (`official`, `media`, `archive`, `leak`). Missing versions are recorded as missing, never reconstructed.
- History in `data/` is never rewritten. Corrections are new commits.
- Be polite to government servers: rate-limit, cache, identify the client.
