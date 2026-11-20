# Notes for Claude

- Read `docs/BRIEF.md` (spec), `docs/ARCHITECTURE.md` (how it fits together) and `docs/decisions/` first. Items marked **(verify)** in the brief are unconfirmed hypotheses.
- Reuse before writing (decision 0005): check whether a tested solution exists; record what was checked in docs/ARCHITECTURE.md.
- Decision (2026-11-20, Dante): single repo `dhantyo/hukum-bersih` holds both data (`data/`, CC0) and code (`pipeline/`, `web/`, AGPL-3.0), instead of the brief's two repos.
- Decision (2026-11-20, Dante): host on Cloudflare Pages (project `hukum-bersih`, `web/wrangler.jsonc`, deployed by `.github/workflows/deploy.yml`). Pages rather than Workers so a `suarakami.id` subdomain can be attached by CNAME. Free-plan limit to watch: 20,000 files per deployment, 25 MiB per file (a problem for phase 2 PP/Perpres).
- Plan (2026-11-20, Dante): initial bulk scraping runs in a Claude cloud session; GitHub Actions does incremental updates. Dante does not want the scraper on his homelab server dm1.
- Finding (2026-11-20): from the Claude cloud container, peraturan.go.id is reachable (use HTTP/1.1; HTTP/2 got a reset once), web.archive.org resets every connection, and peraturan.bpk.go.id returns 403.
- Finding (2026-11-20, 14:06 UTC, probe-sources.yml on a GitHub runner, Azure US IP): `berkas2.dpr.go.id` PDF **206 OK** (so DPR files are NOT simply geo-blocked; the 403 from the Claude container is specific to its egress), `www.dpr.go.id` 403, `web.archive.org` 200, `archive.org` 200, `peraturan.bpk.go.id` 403, `peraturan.go.id` and `jdih.go.id` timed out. peraturan.go.id stopped answering the Claude container (and the runner) from ~13:10 to at least 14:06 and answered again by 19:10: likely outages or rate limiting, so retry with backoff.
- Naming (agreed with Dante 2026-11-20): follow `docs/NAMING.md` everywhere. Ids use `_` between parts and `-` inside a part, number before year (`uu_11_2008`), every text version dated (`uu_11_2008_2008-04-21`), RUU documents `ruu_<slug>_<date>_<type>[_<who>][_<n>]`. No project name in ids or titles (Dante: "a service for the country"); mention hukum-bersih only in archive.org descriptions. Year folders: `data/peraturan/<jenis>/<tahun>/<id>/`.
- Texts are Akoma Ntoso, stored as Bluebell text in `data/` (decision 0004); XML is generated into `web/generated/` (not committed).
- Never commit PDFs. Never rewrite history of `data/`. Never fabricate or reconstruct a missing document version.
- Don't scrape pasal.id.
