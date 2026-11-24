# Architecture

Git is the source of truth; everything else is generated from it.

```
 government sites ─┐
 Wayback Machine  ─┤  pipeline/ (Python)
                   ├─► download ─► data/sources/manifests/*.jsonl (url, sha256; the PDF is not kept)
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
| `pipeline/` | Python package `hukum_bersih`: BPK import, PDF parsing, Akoma Ntoso | AGPL-3.0 |
| `web/` | Astro site: reads Akoma Ntoso XML, renders laws, RUU pages and comparisons | AGPL-3.0 |
| `docs/` | Brief, naming rule, this file, decision records | AGPL-3.0 |

### data/

```
data/
  peraturan/<jenis>/<tahun>/<id>/          one folder per regulation
    <id>.yaml                              title, status, relationships, versions, history
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
| `sources/` | One module per upstream site (`http.py` shared: User-Agent, retries; `wayback.py`). `peraturan_bpk.py` (main source since 2026-11-21) with `bpk_session.py` (Cloudflare: Scrapling browser once, then curl_cffi); `peraturan_go_id.py` (earlier imports; `convert_pdf` is shared) |
| `uploads.py` | Hand-downloaded PDFs (from a GitHub release) → manifest line (sha256) + text |
| `manifest.py` | Source manifest records (sha256 per downloaded file; `archive_url` only on lines from before 2026-11-24) |
| `naming.py` | Id validation (NAMING.md) |
| `records.py` | The schema of a law record (Pydantic, `extra="forbid"`, strict types). `load_record` / `save_record` are the only way to read and write `data/peraturan/**/<id>.yaml`: records stay dicts, `save_record` validates and then dumps the same dict (`allow_unicode`, no key sorting), so a misspelt key or a wrong type fails before anything is written. A new field is added here first |
| `pdf/extract.py` | PDF → cleaned lines (headers, page numbers, footers, signature boxes removed) |
| `pdf/ocr_cache.py` | The engine's raw OCR of each scanned page, kept by the PDF's sha256 + engine + DPI + `OCR_CACHE_VERSION` in `$HUKUM_BERSIH_OCR_CACHE` (default `~/.cache/hukum-bersih/ocr`, `<engine>/<sha256>.json.gz`; `off` disables), so a page is OCR'd once, ever; the spell fix is not cached. Workflows keep it between runs with `.github/actions/ocr-cache` |
| `pdf/ocr_fix.py` | Misread words of scanned pages corrected when a spell check is confident; word lists and shape confusions in `pdf/ocr_rules/` ([decision 0013](decisions/0013-ocr-spell-fix.md)) |
| `pdf/structure.py` | Lines → structural blocks (BAB … Pasal, ayat, huruf/angka, Penjelasan) |
| `akn/bluebell.py` | Blocks → Bluebell text (stored in `data/`) |
| `akn/build.py` | Bluebell → Akoma Ntoso XML (Laws.Africa's `bluebell` parser) |
| `relations.py` | Amends / revokes / enacts links from titles, plus the pasal an amending law changes (from its text) → `relationships` in each record ([decision 0008](decisions/0008-law-history.md)) |
| `amendments.py` | An amending law's Pasal I → numbered instructions and the new wording of each pasal (JSON for the "Perubahan" page) |
| `history.py` | The versions of an amended law and every change to its pasal → `history` in its record, recomputed with `relations` ([decision 0010](decisions/0010-versions-and-merged-text.md)) |
| `cli.py` | `hukum-bersih parse / build-akn / import-bpk / import-peraturan / reparse-bpk / import-pdf / relations / manifest` |

### web/src/

| Path | Job |
|---|---|
| `lib/data.ts` | Reads RUU records from `data/` and generated XML from `web/generated/` |
| `lib/lawdoc.ts` | Akoma Ntoso → render tree + each Pasal as lines |
| `lib/compare.ts` | Match pasal by content, then ayat, then words (diff-match-patch) |
| `lib/versions.ts`, `lib/merge.ts` | A family's versions from the records' `history`; the merged text at one version (original text + amending laws' instructions), with a note per changed pasal (decision 0010) |
| `lib/koleksi.ts` | Collections: `data/koleksi/*.yaml` + automatic ones; members from the relations |
| `lib/lawtext.ts` | Pasal-as-lines types and helpers, shared with the browser (no XML parser) |
| `lib/display.ts` | Reader view helpers: headings in normal capitals, Penjelasan labels in the body's style, "Cukup jelas" ([decision 0009](decisions/0009-law-view-asli-modern.md)) |
| `pages/cari/` | Grouped search: `laws.json` (short names, citations, titles) + Pagefind JS API for the text |
| `lib/amendments.ts` | Apply each amendment's new wording in order → before/after per pasal; short names |
| `components/` | `LawText` / `AknNode` render Akoma Ntoso with `akn-*` classes and eIds as ids, in the reader's view (`ViewSettings`: Asli/Modern, Penjelasan placement, folding); `Riwayat` (history timeline) and `RelationsBanner` (on amending laws); `CompareMode` compares versions inside the reading view |
| `pages/` | `/`, `/uu/`, `/uu/tahun/<tahun>/`, `/uu/<nomor>/<tahun>/`, `/uu/<nomor>/<tahun>/perubahan/` (forwards to the in-place comparison), `/koleksi/`, `/koleksi/<slug>/` (the latest version merged automatically, decision 0010; families without versions: their history and the version comparer), `/koleksi/<slug>/<date>/` (older merged versions), `/koleksi/<slug>/perubahan.json` (data for comparing versions in place, `CompareMode`), `/ruu/`, `/ruu/<slug>/`, `/ruu/<slug>/<doc id>/`, `/ruu/<slug>/beda/<a>...<b>/`, `/cari/`, `/tentang/` |
| `styles/` | `tokens.css` (design tokens, see /DESIGN.md) and `global.css` |
| `lib/peraturan.ts` | Reads regulation records and their generated Akoma Ntoso |

## Workflows (.github/workflows)

| Workflow | When | What |
|---|---|---|
| `ci.yml` | every push | pipeline lint + tests; build AKN; web tests (incl. M1 check) + build; no PDFs in git |
| `deploy.yml` | push to default branch | build AKN + site, deploy to Cloudflare Pages |
| `import-bpk.yml` | manual (schedule paused 2026-11-21 until the parser is fixed; normally every 6 h) | `mode: import`: BPK metadata, every PDF's sha256 recorded (Hugging Face mirror if BPK's download fails; nothing is uploaded to archive.org since 2026-11-24), text from BPK's PDF with the current parser, never replacing a text with one that has fewer pasal. `mode: reparse`: texts re-converted from our archive.org copies (hash-checked), no BPK. `only`, `no_text` for samples |
| `parser-regression.yml` | push touching the parser + manual | the regression set (`pipeline/tests/regression.yaml`, fails on any law off) |
| `import-peraturan.yml` | manual (schedule removed 2026-11-21) | import from peraturan.go.id (answers only Indonesian IPs; the Indonesian VPN action was removed 2026-11-24, so it works only when the site lets other IPs in) |
| `import-uploads.yml` | manual | PDFs attached to a GitHub release → manifest line (sha256) + text (`import-pdf`) |
| ~~`fetch.yml`, `archive-pending.yml`, `archive-retitle.yml`, `archive-delete.yml`~~ | removed 2026-11-24 ([decision 0014](decisions/0014-no-archive-uploads.md)) | download + upload to archive.org, retitle, delete |
| ~~`probe-bpk.yml`, `explore-bpk.yml`, `probe-bpk-app.yml`~~ | removed 2026-11-24 (last in c3332cfb) | one-off probes: which tool passes BPK's Cloudflare check (Scrapling won, `sources/bpk_session.py`); sample BPK pages (now `pipeline/tests/fixtures/bpk/`); BPK's Android app (never got the APK) |

Where things run: everything recurring runs on GitHub Actions (no Claude session or personal
computer needed). GitHub runners reach DPR files and the Wayback Machine, but peraturan.go.id only while it
lets non-Indonesian IPs in. See [sources.md](sources.md) for what each site answers.

## Reused instead of written

| Need | Used | Notes |
|---|---|---|
| Legal document model | Akoma Ntoso (OASIS LegalDocML) | [decision 0004](decisions/0004-akoma-ntoso-bluebell.md) |
| Text format ↔ Akoma Ntoso | `bluebell-akn` (Laws.Africa) | |
| Check that generated XML is valid Akoma Ntoso | OASIS Akoma Ntoso 3.0 XSD (downloaded in CI, sha256 pinned in `pipeline/scripts/validate_akn.py`) + `lxml` | blocks CI; laws with no known date keep the year and are listed |
| Check workflow files | `actionlint` (rhysd, pinned v1.7.7), job `actionlint` in `ci.yml` | shellcheck integration off (style notes only) |
| Word diff | `@sanity/diff-match-patch` (Google's diff-match-patch) | semantic cleanup groups edits |
| Matching reworded ayat, finding where text went | TF-IDF cosine similarity (standard information-retrieval weighting) | common legal words weigh little; a pointer is shown only for a clear best match |
| Comparison layout | Synopsis / DIM-style side-by-side table | [decision 0006](decisions/0006-comparison-as-synopsis.md); `xmldiff` tried and rejected |
| XML in the browser build | `@xmldom/xmldom` | |
| archive.org | (nothing: no uploads since 2026-11-24, [decision 0014](decisions/0014-no-archive-uploads.md)); existing copies are read with `urllib` | `internetarchive` and `pikepdf` dependencies removed |
| PDF text | PyMuPDF | |
| OCR of scanned pages | Indra OCR (`indra-ocr`, CPU; Tesseract `ind` as fallback) | [decision 0012](decisions/0012-indra-ocr.md): checked on hand-typed ground truth against Tesseract (Ubuntu and `tessdata_best`), PaddleOCR (server, mobile/RapidOCR, VL), GLM-OCR, MinerU2.5-Pro, markitdown |
| Lookalike letters in OCR'd words (ı, Greek/Cyrillic) | `confusable-homoglyphs` (Unicode UTS #39 `confusables.txt` data, MIT) | checked: `confusables` (normalizes whole strings with several readings, no per-letter mapping), PyICU spoof checker (needs system ICU, only reports, does not map), `confusables.txt` by hand (the package ships the same data with a lookup). Applied only inside words with a Latin letter ([decision 0013](decisions/0013-ocr-spell-fix.md)) |
| Correcting OCR misreads | Norvig's spelling corrector (one edit) over our own typed texts' words, Hunspell `id_ID` + `en_US` (system packages) as the list of real words never changed | [decision 0013](decisions/0013-ocr-spell-fix.md). Checked: Pasal.id's `ocr_correct.py` (one regex per misread word, changes case: not used), SymSpell/`symspellpy` (fast edit-distance lookup, but no weights for letter shapes and speed is not the limit: not used) |
| Validating law records before they are written | Pydantic v2 (`records.py`) | models are the gate only: the code keeps working with dicts and the YAML is dumped from the dict, byte for byte as before |
| Search | Pagefind | |
| Showing a law's history | legislation.gov.uk "changes over time", Fedlex "Chronologie" | [decision 0008](decisions/0008-law-history.md); relations parsed with our own regexes over our own data |
| Repealed / not-yet-consolidated warning | legislation.gov.uk "changes to legislation", Fedlex "nicht mehr in Kraft" banners | `StatusBanner.astro` |
| Getting back to the contents on long pages | GOV.UK "back to top" pattern | `DocLayout.astro` |
| Comparing versions in the reading view | Fedlex's comparison view (two columns, inserted / deleted / modified / no counterpart, change marks in the contents) | `CompareMode.astro`, decision 0010 |
| Animation (springs, layout, drag) | Motion (`motion`, MIT, vanilla `animate`, `animateLayout`, `drag`) | checked 2026-11-22: GSAP (Flip is good, but its licence is GSAP's own "no charge" licence, not open source), FormKit AutoAnimate (MIT, but only add/remove/move, no drag or springs), SortableJS (MIT, CSS-transition reorder; dropped because Motion's `drag` covers the one gesture we need), Swapy (GPL-3.0). View Transitions API used before; it cross-fades the whole page and cannot follow a drag |
| Rendering very long laws | CSS `content-visibility: auto` | per chapter in `LawText.astro` |
| Search for "pasal 27 ITE" | citation lookup as on legislation.gov.uk / Pasal.id, over our own `laws.json` | `pages/cari/`; Pagefind's prefix fallback ("xyzqq" → "x") is filtered out by checking the highlighted words |
| Raw UU text → structure (BAB … Pasal, ayat, lists, Penjelasan) | nothing reused: own parser `pdf/structure.py`; rewrite planned as a rule registry for line classes and a table-driven state machine ([parser-rules.md](parser-rules.md#design-for-the-rewrite)) | Checked 2026-11-24. `lark` (MIT, 1.3.1 of 2025-10): a context-free grammar over classified lines (`pipeline/scripts/grammar_prototype.py blocks`) got 13 of 20 regression laws right, wrong counts or no parse on amending laws and old layouts, since the sequence and amending rules count and look ahead. `parsimonious` (MIT, PEG, last push 2025-11): same class of grammar, same limit, not run. Slaw (Laws.Africa, MIT, Treetop grammar per country): archived 2022. Indigo (Laws.Africa, LGPL-3.0, active) imports with docpipe stages (GPL-3.0), one class per rule, writing Bluebell. bluebell (LGPL-3.0+, Canopy PEG): parses its own keyword markup, not raw text. Pasal.id `parse_structure.py` (AGPL-3.0): regex scan for markers, no sequence check; noise lines become content in all of them |
| Links from a law's text to the laws and pasal it cites (planned) | `lark` grammar for reference phrases at anchors, as Indigo does with `provision_refs.peg`; law part from `relations.CITE`; output Bluebell `{{>href text}}` | Prototype `grammar_prototype.py refs` reads all 7 forms of UU 12/2011 Lampiran II items 44-283 (lists, ranges, exceptions). Chosen over Canopy (needs a Node compile step) and over regexes (no tree for `Pasal 7 ayat (2) dan ayat (4)`) |
| Law view (Asli/Modern, folding, notes under provisions) | legislation.gov.uk "Original (As enacted)", Fedlex "Alles einblenden/ausblenden" and footnotes under articles, e-Gov per-part show/hide, New Zealand facts for assent (docs/research-law-display-2026-11.md) | [decision 0009](decisions/0009-law-view-asli-modern.md) |
| Indonesian PDF quirks | Pasal.id parser (AGPL) | to port: peraturan.go.id headers/footers, page-break dedup, OCR fixes, amendment laws |
| BPK PDFs without Cloudflare (up to ~April 2025) | Hugging Face `Azzindani/ID_REG` (Apache-2.0), single files read from its zips by range request | byte-identical to BPK downloads (3/3 checked 2026-11-21); the importer falls back to it when a BPK download fails. `ID_REG_Parsed` (flat, one row per pasal) only for cross-checks |
| Getting past peraturan.bpk.go.id's Cloudflare check (managed challenge) | Scrapling `StealthyFetcher(solve_cloudflare=True, real_chrome=True)` (BSD-3) to get `cf_clearance`, then `curl_cffi` with the same cookies and user agent | `probe-bpk.yml`, 2026-11-21: the only one of four that passed from GitHub runners (2/2; PDF fetched in the browser and again with curl_cffi). Failed: plain Playwright (control), SeleniumBase UC mode, Camoufox (checkbox not clicked). Not used: CloakBrowser (binary needs a licence key), FlareSolverr (README: cannot solve CAPTCHAs), origin-IP finders (go around the site's protection), paid CAPTCHA services |
