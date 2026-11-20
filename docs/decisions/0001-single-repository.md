# 0001 Single repository for data and code

Date: 2026-11-20 · Decided by: Dante

The brief planned two repos (data, code). We use one: `dhantyo/hukum-bersih`, with `data/`
(CC0) next to `pipeline/` and `web/` (AGPL-3.0).

Why: a data change rebuilds the site without cross-repo triggers, and one history is simpler.
Trade-off: forking only the data is less convenient. `data/` can be split out later with its
full history (`git subtree split`).
