# Notes for Claude

- Read `docs/BRIEF.md` first: it is the project spec. Items marked **(verify)** are unconfirmed hypotheses.
- Decision (2026-11-20, Dante): single repo `dhantyo/hukum-bersih` holds both data (`data/`, CC0) and code (`scraper/`, `web/`, AGPL-3.0), instead of the brief's two repos.
- Decision (2026-11-20, Dante): host on Cloudflare Pages (project `hukum-bersih`, `web/wrangler.jsonc`, deployed by `.github/workflows/deploy.yml`). Pages rather than Workers so a `suarakami.id` subdomain can be attached by CNAME. Free-plan limit to watch: 20,000 files per deployment, 25 MiB per file (a problem for phase 2 PP/Perpres).
- Plan (2026-11-20, Dante): initial bulk scraping runs in a Claude cloud session; GitHub Actions does incremental updates. Dante does not want the scraper on his homelab server dm1.
- Finding (2026-11-20): from the Claude cloud container, peraturan.go.id is reachable (use HTTP/1.1; HTTP/2 got a reset once), web.archive.org resets every connection, and peraturan.bpk.go.id returns 403.
- Finding (2026-11-20): from a US datacenter IP, both `berkas2.dpr.go.id` and `www.dpr.go.id` returned 403, so GitHub-hosted runners likely can't reach DPR at all.
- Never commit PDFs. Never rewrite history of `data/`. Never fabricate or reconstruct a missing document version.
- Don't scrape pasal.id.
