# Hukum Bersih

Situs terbuka untuk hukum Indonesia: teks peraturan yang bersih dan mudah dicari, pelacakan RUU beserta setiap versi drafnya, dan perbandingan perubahan antarversi.

An open, layman-friendly tracker for Indonesian law: clean searchable text, RUU (draft bill) tracking with every draft version and its provenance, and diffs between versions.

## Layout

| Path | What | License |
|---|---|---|
| `data/` | Law and RUU texts (Bluebell / Akoma Ntoso), YAML records, source manifests. **Source of truth.** No PDFs. | [CC0 1.0](data/LICENSE) |
| `pipeline/` | Python: fetch, archive, PDF → Akoma Ntoso | [AGPL-3.0](LICENSE) |
| `web-solid/` | Solid 2 reader on a Cloudflare Worker (prerendered pages, Pagefind search) | [AGPL-3.0](LICENSE) |
| `docs/` | [Architecture](docs/ARCHITECTURE.md), [naming](docs/NAMING.md), [decisions](docs/decisions/), brief | AGPL-3.0 |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the pieces fit together.

## Development

Pipeline (Python ≥ 3.12, [uv](https://docs.astral.sh/uv/)):

```bash
cd pipeline && uv sync && uv run pytest
```

Website (`web-solid/`, previewed by `.github/workflows/solid-preview.yml`; Node and pnpm versions in `web-solid/.node-version` and `web-solid/package.json`). The corpus export and local run are in [web-solid/README.md](web-solid/README.md).

Check that the generated Akoma Ntoso is valid (as CI does):

```bash
cd pipeline && uv run hukum-bersih build-akn --out /tmp/akn && uv run python scripts/validate_akn.py /tmp/akn
```

## Ground rules

- PDFs never go into git; only their URL and sha256 are recorded (copies archived on the Internet Archive before 2026-11-24 stay linked).
- Every document carries provenance (`official`, `media`, `archive`, `leak`). Missing versions are recorded as missing, never reconstructed.
- History in `data/` is never rewritten. Corrections are new commits.
- Be polite to government servers: rate-limit, cache, identify the client.
