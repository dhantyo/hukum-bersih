# Notes for Claude

Hukum Bersih publishes clean Indonesian law texts and tracks draft bills. `data/` (CC0) is the source of truth; `pipeline/` (Python) and `web/` (Solid 2 on a Cloudflare Worker) are AGPL-3.0. The Astro site was removed in PR 2 of the Solid migration; `web/` is renamed to `web/` in a later PR.

## Read when you need it

| Before you | Read |
|---|---|
| Change anything structural | `docs/ARCHITECTURE.md`, then `docs/decisions/` |
| Name an id, file or folder | `docs/NAMING.md` |
| Work in `pipeline/` or `web/` | that folder's `CLAUDE.md` (loads on its own there) |
| Touch an upstream site (BPK, peraturan.go.id, DPR, mirrors) | `docs/sources.md` |
| Pick up open work or a known gap | `docs/open-items.md` |
| Change something that could make a page slower, or measure speed | `docs/performance.md` |
| Check what the project is for | `docs/BRIEF.md` (items marked **(verify)** are unconfirmed) |

Code, tests and workflow files are the source of truth for numbers, thresholds and behaviour. Docs point to the constant or file; they do not copy its value.

## Rules

- Keep the source text as printed. Never modernise old spelling (Djakarta, jang, PENDJELASAN, Nopember) or fix the source's typos. The parser may recognise old forms to find structure. OCR fixes are allowed only for clear machine misreads (REPUEUK to REPUBLIK).
- Never commit PDFs. Never rewrite the history of `data/`. Never fabricate or reconstruct a missing document version, and never make up a date.
- Don't scrape pasal.id.
- Ask before adding a new source or regulation type (ministry rules such as Permen are not imported).
- Reuse before writing (decision 0005): look for a tested solution first, and record what you checked in the "Reused instead of written" table of `docs/ARCHITECTURE.md`.
- Imports and other heavy runs (OCR, regression checks) run on GitHub Actions, not on a local computer or a personal server. Scheduled workflows run only from the default branch.
- No personal names in code, comments, tests or workflows. Attribute a rule by date and example ("2026-11-24: UU 100/2024 ...").
- Record a lasting choice as a new file in `docs/decisions/`, not here. Record a finding about a site in `docs/sources.md`.

## How to work

- Run tasks with the pstack plugin (`/pstack:poteto-mode`, enabled in `.claude/settings.json`).
- After writing or changing code, run the `clean-code-guard` skill. After tests, run `test-guard`. After docs, run `docs-guard`. The skills live in `.agents/skills/` (pinned in `skills-lock.json`).
- Other agents share this checkout. Stage files by name, never `git add -A`.
- Use Conventional Commits for every commit and PR title: `type(scope): subject`, with type `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore` or `ci` (`fix(pdf): ...`). Name branches `type/short-topic` with the same types (`fix/refused-ocr-reparse`). Branch from `main`.
- Delete the branch once its PR is merged: merge with `gh pr merge <n> --merge --delete-branch` (removes the remote and local branch), and `git fetch --prune`.
- Tell every agent you start to follow these naming rules too.
