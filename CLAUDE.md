# Notes for Claude

- Read `docs/BRIEF.md` first: it is the project spec. Items marked **(verify)** are unconfirmed hypotheses.
- Decision (2026-11-20, Dante): single repo `dhantyo/hukum-bersih` holds both data (`data/`, CC0) and code (`scraper/`, `web/`, AGPL-3.0), instead of the brief's two repos.
- Decision (2026-11-20, Dante): host on GitHub Pages (`.github/workflows/deploy.yml`), not Cloudflare. Dante does not want the scraper on his homelab server dm1.
- Finding (2026-11-20): from a US datacenter IP, both `berkas2.dpr.go.id` and `www.dpr.go.id` returned 403, so GitHub-hosted runners likely can't reach DPR at all.
- Never commit PDFs. Never rewrite history of `data/`. Never fabricate or reconstruct a missing document version.
- Don't scrape pasal.id.
