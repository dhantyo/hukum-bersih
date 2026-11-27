# Hukum Rapih

[![CI](https://github.com/dhantyo/hukum-rapih/actions/workflows/ci.yml/badge.svg)](https://github.com/dhantyo/hukum-rapih/actions/workflows/ci.yml)
[![Deploy site](https://github.com/dhantyo/hukum-rapih/actions/workflows/deploy.yml/badge.svg)](https://github.com/dhantyo/hukum-rapih/actions/workflows/deploy.yml)

Situs terbuka untuk hukum Indonesia: teks peraturan yang bersih dan mudah dicari, pelacakan RUU beserta setiap versi drafnya, dan perbandingan perubahan antarversi.

An open, layman-friendly tracker for Indonesian law: clean searchable text, RUU (draft bill) tracking with every draft version and its provenance, and diffs between versions.

## Layout

| Path | What | License |
|---|---|---|
| `data/` | Law and RUU texts (Bluebell / Akoma Ntoso), YAML records, source manifests. **Source of truth.** No PDFs. | [CC0 1.0](data/LICENSE) |
| `pipeline/` | Python: fetch, archive, PDF → Akoma Ntoso | [AGPL-3.0](LICENSE) |
| `web/` | Solid 2 reader on a Cloudflare Worker (prerendered pages, Pagefind search) | [AGPL-3.0](LICENSE) |
| `docs/` | [Architecture](docs/ARCHITECTURE.md), [naming](docs/NAMING.md), [decisions](docs/decisions/), brief | AGPL-3.0 |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the pieces fit together.

## Development

Pipeline (Python ≥ 3.12, [uv](https://docs.astral.sh/uv/)):

```bash
cd pipeline && uv sync && uv run pytest
```

Website (`web/`, deployed by `.github/workflows/deploy.yml`; Node and pnpm versions in `web/.node-version` and `web/package.json`). The corpus export and local run are in [web/README.md](web/README.md).

Check that the generated Akoma Ntoso is valid (as CI does):

```bash
cd pipeline && uv run hukum-rapih build-akn --out /tmp/akn && uv run python scripts/validate_akn.py /tmp/akn
```

## Ground rules

- PDFs never go into git; only their URL and sha256 are recorded (copies archived on the Internet Archive before 2026-11-24 stay linked).
- Every document carries provenance (`official`, `media`, `archive`, `leak`). Missing versions are recorded as missing, never reconstructed.
- History in `data/` is never rewritten. Corrections are new commits.
- Be polite to government servers: rate-limit, cache, identify the client.
