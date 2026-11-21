# Architecture

Git is the source of truth; everything else is generated from it.

```
 government sites ─┐
 Wayback Machine  ─┤  pipeline/ (Python)
                   ├─► fetch ──► archive.org (original PDFs, named by id)
                   │            └► data/sources/manifests/*.jsonl (url, sha256, archive url)
                   └─► parse ──► data/**/<id>.txt (Bluebell text) + YAML records
                                          │  git push
                                          ▼
              pipeline build-akn ──► Akoma Ntoso XML (web/generated/, not in git)
                                          │
                                          ▼
              web/ (Astro, static) ──► Cloudflare Pages, Pagefind search
```

## Repository

| Path | What | License |
|---|---|---|
| `data/` | Source of truth: texts (Bluebell), YAML records, source manifests. No PDFs. | CC0 |
| `pipeline/` | Python package `hukum_bersih`: fetch, archive, PDF parsing, Akoma Ntoso | AGPL-3.0 |
| `web/` | Astro site: reads Akoma Ntoso XML, renders laws, RUU pages and comparisons | AGPL-3.0 |
| `docs/` | Brief, naming rule, this file, decision records | AGPL-3.0 |

### data/

```
data/
  peraturan/<jenis>/<tahun>/<id>/          one folder per regulation
    <id>.yaml                              title, status, relationships, versions
    <id>_<YYYY-MM-DD>.txt                  each text version, dated (Bluebell)
  koleksi/<slug>.yaml                      a named law family: short name, base law, aliases
  ruu/<slug>/
    ruu.yaml                               stages, every known document with provenance
    versions/<doc id>.txt                  draft texts (Bluebell)
  sources/manifests/<host>.jsonl           one line per fetched file
```

Names follow [NAMING.md](NAMING.md).

### pipeline/src/hukum_bersih/

| Module | Job |
|---|---|
| `sources/` | One module per upstream site (`http.py` shared: User-Agent, retries; `wayback.py`) |
| `fetch.py` | Download → archive.org → manifest line; skips unchanged files by sha256 |
| `archive.py` | archive.org upload, retitle, empty obsolete items |
| `manifest.py` | Source manifest records |
| `naming.py` | Ids and titles (NAMING.md) |
| `pdf/extract.py` | PDF → cleaned lines (headers, page numbers, footers, signature boxes removed) |
| `pdf/structure.py` | Lines → structural blocks (BAB … Pasal, ayat, huruf/angka, Penjelasan) |
| `akn/bluebell.py` | Blocks → Bluebell text (stored in `data/`) |
| `akn/build.py` | Bluebell → Akoma Ntoso XML (Laws.Africa's `bluebell` parser) |
| `relations.py` | Amends / revokes / enacts links from titles, plus the pasal an amending law changes (from its text) → `relationships` in each record ([decision 0008](decisions/0008-law-history.md)) |
| `amendments.py` | An amending law's Pasal I → numbered instructions and the new wording of each pasal (JSON for the "Perubahan" page) |
| `cli.py` | `hukum-bersih fetch / parse / build-akn / relations / archive-*` |

### web/src/

| Path | Job |
|---|---|
| `lib/data.ts` | Reads RUU records from `data/` and generated XML from `web/generated/` |
| `lib/lawdoc.ts` | Akoma Ntoso → render tree + each Pasal as lines |
| `lib/compare.ts` | Match pasal by content, then ayat, then words (diff-match-patch) |
| `lib/koleksi.ts` | Collections: `data/koleksi/*.yaml` + automatic ones; members from the relations |
| `lib/lawtext.ts` | Pasal-as-lines types and helpers, shared with the browser (no XML parser) |
| `pages/cari/` | Grouped search: `laws.json` (short names, citations, titles) + Pagefind JS API for the text |
| `lib/amendments.ts` | Apply each amendment's new wording in order → before/after per pasal; short names |
| `components/` | `LawText` / `AknNode` render Akoma Ntoso with `akn-*` classes and eIds as ids; `Riwayat` (history timeline) and `RelationsBanner` (on amending laws) |
| `pages/` | `/`, `/uu/`, `/uu/tahun/<tahun>/`, `/uu/<nomor>/<tahun>/`, `/uu/<nomor>/<tahun>/perubahan/`, `/koleksi/`, `/koleksi/<slug>/` (with the version comparer), `/ruu/`, `/ruu/<slug>/`, `/ruu/<slug>/<doc id>/`, `/ruu/<slug>/beda/<a>...<b>/`, `/cari/`, `/tentang/` |
| `styles/` | `tokens.css` (design tokens, see /DESIGN.md) and `global.css` |
| `lib/peraturan.ts` | Reads regulation records and their generated Akoma Ntoso |

## Workflows (.github/workflows)

| Workflow | When | What |
|---|---|---|
| `ci.yml` | every push | pipeline lint + tests; build AKN; web tests (incl. M1 check) + build; no PDFs in git |
| `deploy.yml` | push to default branch | build AKN + site, deploy to Cloudflare Pages |
| `fetch.yml` | manual | fetch + archive `id URL` pairs, commit manifest lines |
| `archive-retitle.yml` | manual | rewrite archive.org titles/descriptions |
| `archive-delete.yml` | manual | empty obsolete archive.org items |
| `import-peraturan.yml` | every 6 h + manual | import regulations from peraturan.go.id in batches of 50; resumes; afterwards picks up new ones; recomputes relationships after each batch |
| `archive-pending.yml` | daily + manual | archive regulation PDFs the importer recorded (batches of 150) |
| `probe-sources.yml` | manual | which sources a GitHub runner can reach |

Where things run: everything recurring runs on GitHub Actions (no Claude session or personal
computer needed). GitHub runners reach DPR files, the Wayback Machine and (since 2026-11-20
evening) peraturan.go.id. See CLAUDE.md for the latest findings.

## Reused instead of written

| Need | Used | Notes |
|---|---|---|
| Legal document model | Akoma Ntoso (OASIS LegalDocML) | [decision 0004](decisions/0004-akoma-ntoso-bluebell.md) |
| Text format ↔ Akoma Ntoso | `bluebell-akn` (Laws.Africa) | |
| Word diff | `@sanity/diff-match-patch` (Google's diff-match-patch) | semantic cleanup groups edits |
| Matching reworded ayat, finding where text went | TF-IDF cosine similarity (standard information-retrieval weighting) | common legal words weigh little; a pointer is shown only for a clear best match |
| Comparison layout | Synopsis / DIM-style side-by-side table | [decision 0006](decisions/0006-comparison-as-synopsis.md); `xmldiff` tried and rejected |
| XML in the browser build | `@xmldom/xmldom` | |
| archive.org | `internetarchive` | |
| PDF text | PyMuPDF | |
| Search | Pagefind | |
| Showing a law's history | legislation.gov.uk "changes over time", Fedlex "Chronologie" | [decision 0008](decisions/0008-law-history.md); relations parsed with our own regexes over our own data |
| Indonesian PDF quirks | Pasal.id parser (AGPL) | to port: peraturan.go.id headers/footers, page-break dedup, OCR fixes, amendment laws |
