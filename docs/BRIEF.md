# Project brief: open Indonesian law tracker

Handover from a planning session on 2026-11-20. Facts about external sites were checked on that date and may have changed: re-verify anything marked **(verify)** before building on it.

Owner: Dante. Ask him before making any decision listed under "Open questions".

---

## 1. Goal

A free, modern, layman-friendly website for Indonesian law that:

1. Shows laws as clean, readable, searchable text (not PDFs).
2. Tracks **RUU** (draft bills) through the legislative process, including every draft version that ever appeared, with where each version came from.
3. Shows **what changed** between versions: draft vs. draft, and later law vs. amended law.
4. Later: plain-language summaries, always linked to the exact pasal they summarise.

### Non-goals (for now)

- No user accounts, comments, or alerts.
- No database server.
- No regional regulations (Perda etc.) until the national core works.
- No scraping of pasal.id (see §4.6).

---

## 2. Architecture (decided)

**Git is the source of truth. Everything else is generated from it.**

```
government sites ──► scraper (Python, Indonesian IP) ──► DATA repo (Markdown + YAML, CC0)
                                                              │  git push
                                                              ▼
                                          WEB repo: GitHub Actions build
                                          Astro static site + Pagefind search index
                                                              │
                                                              ▼
                                          GitHub Pages or Cloudflare Pages (free)
```

Two repositories (names are placeholders, ask Dante):

| Repo | Contents | License |
|---|---|---|
| `hukum-data` | Law and RUU text as Markdown, metadata in front matter / YAML, source manifests. **No PDFs.** | CC0 (law text is public domain anyway, see §7) |
| `hukum-web` | Scraper + parser (Python) and the website (Astro/TypeScript) | AGPL-3.0 (required if we reuse Pasal.id's parser code, see §5.2) |

Why this shape:
- Every change to a law or draft is a git commit, so history and diffs come for free.
- Anyone can fork the data repo; it survives even if the website dies.
- Static hosting is free; search runs in the browser from a prebuilt index.
- A database (e.g. Supabase free tier) is added **only** if we later need live features or outgrow static search. If added, it is a derived index rebuilt from git, never a second source of truth.

### Hosting and size limits to design around (checked 2026-11-20)

| Limit | Value | Implication |
|---|---|---|
| GitHub: single file | 100 MB hard block (1 MB recommended) | Never commit PDFs. One DPR document is 104.7 MB. |
| GitHub: per push | 2 GB hard | Do the initial bulk import in several pushes. |
| GitHub: repo size | ~10 GB on-disk recommended | Fine for national laws as text. Perda later in a separate repo. |
| GitHub Pages | 1 GB per published site, 100 GB/month soft bandwidth | Enough for UU + RUU. Probably not for all ~17k central regulations. |
| Cloudflare Pages (free) | 20,000 files per site, 25 MiB per file | Pagefind chunk files count toward the 20k. |

---

## 3. Phasing and scope

| Phase | Content | Rough size |
|---|---|---|
| 1 | All **UU** + all **RUU** tracked on the DPR site | ~1,900 UU |
| 2 | **PP, Perpres**, other central regulations | ~17,400 central regulations total (BPK count) |
| 3 | Perda etc., in a separate data repo | ~265,000 regional regulations (BPK count) |

---

## 4. Data sources

### 4.1 DPR RUU pages (primary source for RUU tracking)

- Each RUU has a detail page, e.g. RUU Perampasan Aset:
  `https://www.dpr.go.id/kegiatan-dpr/fungsi-dpr/fungsi-legislasi/partisipasi-legislasi/detail/RUU-tentang-Perampasan-Aset-RUU-tentang-Perampasan-Aset-Terkait-Dengan-Tindak-Pidana--707`
- The site is a Next.js app. Page data is loaded via `POST https://www.dpr.go.id/gql` (GraphQL). **First task: open devtools, capture that GraphQL query, and call it directly** instead of scraping HTML. (verify)
- Data shape observed in the page's React props for one stage:
  ```
  { alur: "pembicaraan tingkat ii di rapat paripurna",
    riwayat: [ { title, tanggal: "2026-11-19",
                 akdDokumen: [ { fileLink, fileSizeMb, idMenu,
                                 menuAkd: { id, title } } ] } ] }
  ```
- Stages (tabs on the page): `Dukungan Penyusunan oleh BKD`, `Penyusunan oleh Komisi/Baleg/Anggota`, `Penetapan Usul DPR di Rapat Paripurna`, `Pembicaraan Tingkat I`, `Pembicaraan Tingkat II di Rapat Paripurna`.
- Document types seen (`menuAkd.title`): `Draft RUU`, `Draft RUU Final`, `Draft NA`, `Naskah Urgensi`, `Daftar Inventaris Masalah (DIM)`, `Surat Presiden`, `Laporan Komisi`, `Tanggapan Pemerintah`, `Pandangan Mini Fraksi`, `Risalah Rapat`, `Laporan Singkat`, `Bahan Narasumber`, `Dokumen Pendukung Lain`. Some entries have `fileLink: null`.
- **Geo-block:** every file on `berkas.dpr.go.id` and `berkas2.dpr.go.id` returned **403 Access Denied (Akamai)** from a German IP, including the site's own images and its own download buttons, while `www.dpr.go.id` loaded fine. Most likely these servers serve Indonesian IPs only. **The scraper must download DPR files through an Indonesian IP.** (verify)
- Many documents were only uploaded late (e.g. drafts posted 9–19 Nov 2026 for an RUU discussed all year), so poll regularly.

### 4.2 peraturan.go.id (primary source for enacted law)

Based on Pasal.id's working scraper (§5.2); verify before relying on it:
- Listing pages per type: `/uu?page=1`, `/pp?page=1`, …
- Each regulation has a detail page with an HTML metadata table. Labels to map: `Pemrakarsa`, `Tempat Penetapan`, `Ditetapkan Tanggal`, `Pejabat yang Menetapkan`, `Status` (`Berlaku` / `Dicabut` / `Diubah` / `Tidak Berlaku`), `Nomor Pengundangan`, `Nomor Tambahan`, `Tanggal Pengundangan`, `Pejabat Pengundangan`, `Tentang`. Dates are Indonesian (`13 Januari 2026`).
- **PDF URLs are unpredictable**: you must parse the detail page to find the real download link.
- Reported as easy to scrape. Be polite anyway (≈2 s between requests, identifiable User-Agent).
- No official API.

### 4.3 JDIHN member feeds (discovery and metadata)

- JDIH member sites publish a JSON feed of their documents that the national JDIHN portal pulls. For ILDIS-based sites it is `https://<domain>/feed/document.json`; other members differ. (verify per site)
- Gives metadata and often PDF links. Coverage and quality vary by agency; some leave `urlDownload` as `"-"`.

### 4.4 peraturan.bpk.go.id (later)

- Largest collection, with good metadata and amendment-status links.
- Returns 403 to non-browser requests: needs a headless browser (Playwright). Phase 2+.

### 4.5 Fallbacks for vanished documents

- Wayback Machine (`web.archive.org`). Example: PPATK removed its 2023 RUU Perampasan Aset draft (now 404) but the Wayback Machine has it.
- Media copies of drafts that were never officially published (Kumparan, Katadata, etc.). Always label these as non-official (§6.3).

### 4.6 Pasal.id (reference only)

- Open-source project (AGPL-3.0): https://github.com/ilhamfp/pasal. Public repo last commit 1 Mar 2026; the live site has changed since.
- Live API (`https://pasal.id/api/v1`) is a **discovery API**: metadata and links only, **no regulation text**. Needs a free personal token (pasal.id/akun). Rate limits: `/search` 60/min and 360/h, `/laws` 180/min and 900/h, `/laws/{frbr}` 60/min and 360/h. CORS only allows pasal.id and allowlisted domains. Bulk or licensed content only by written agreement (halo@pasal.id).
- **Do not scrape pasal.id.** Optional later: use the API to cross-check status or link to their reader.

### 4.7 Sources that turned out to be dead ends

- `Open-Technology-Foundation/peraturan.go.id` on GitHub: despite claims, it contains **no law text**, only scripts and config for an AI search system. Its data folder is a symlink to a path on the author's server. One commit (July 2025). Don't use it.
- `api-jdih.perpusnas.go.id`: listed in Pasal.id's notes as the only documented public REST API (token required). **Untested.** Worth a quick check.

---

## 5. Pipeline

### 5.1 Where it runs

- On Dante's homelab server **dm1** (MX Linux, Docker) as a container, with egress through an **Indonesian VPN** (e.g. a gluetun-style VPN container), **or** on a small Indonesian VPS. Ask Dante which.
- dm1 must **not** serve public traffic; it only runs the scraper and pushes to the data repo (deploy key).
- Start it as early as possible: documents disappear (PPATK) and get geo-blocked (DPR).

### 5.2 PDF → structured text (reuse Pasal.id's parser)

Pasal.id's `scripts/parser/` does exactly this (Python 3.12, PyMuPDF):

1. `classify_pdf.py`: classifies each PDF as `born_digital`, `scanned_clean` (has a text layer with OCR noise), or `image_only`.
2. `extract_pymupdf.py`: extracts text; dedupes repeated text at page breaks; strips noise (running headers, `www.peraturan.go.id` footers, timestamps).
3. `ocr_correct.py`: deterministic OCR fixes.
4. `parse_structure.py`: regex state machine producing a tree:
   `preamble → BAB → Bagian → Paragraf → Pasal → ayat`, plus `PENJELASAN` (umum and per pasal), `LAMPIRAN`, and `ATURAN PERALIHAN` / `ATURAN TAMBAHAN`. Note: Roman-numeral Pasal (`Pasal I`, `Pasal II`) are real in amendment laws and must be preserved.

Gaps to fill ourselves:
- **OCR for `image_only` PDFs.** Pasal.id just marks these "needs OCR" and stores no text. Use OCRmyPDF/Tesseract with the `ind` language.
- **Amendment relationships.** In Pasal.id's public code these were hand-seeded for a few demo laws, not extracted. Start with titles (`Perubahan atas …`, `Pencabutan …`) and the status field; later parse the amendment instructions.

Reusing this code makes `hukum-web` AGPL-3.0. That's fine; it's meant to be open.

### 5.3 Archiving rules

For every fetched file, record in a source manifest: `source_url`, `fetched_at`, `sha256`, `bytes`, `archive_url`.
- **PDFs never go into git.** Push them to the Internet Archive instead: upload as items with the `internetarchive` CLI, which also works for geo-blocked DPR files the Wayback crawler can't reach. Also request a Wayback capture of public URLs.
- Skip unchanged files by hash (idempotent runs).
- One commit per document change, with a meaningful message, e.g. `ruu/perampasan-aset: add Draft RUU Final (DPR, 2026-11-19)`.
- **Never rewrite history** in the data repo. Corrections are new commits.

---

## 6. Data model (data repo)

### 6.1 Layout

```
peraturan/
  uu/2010/uu-8-2010.md
  pp/2021/pp-35-2021.md
ruu/
  perampasan-aset/
    ruu.yaml                       # tracker record (stages, documents, provenance)
    versions/
      2023-05-pemerintah.md        # one Markdown file per draft version
      2026-11-09-draft-dpr.md
      2026-11-19-draft-final.md
sources/
  manifests/…                      # fetch records (url, fetched_at, sha256, archive_url)
```

Folders by type and year so no directory holds thousands of files.

### 6.2 Law file format

Front matter (adopt Akoma Ntoso FRBR-style IDs like Pasal.id for interoperability):

```yaml
---
id: /akn/id/act/uu/2010/8
type: UU
number: "8"
year: 2010
title: Pencegahan dan Pemberantasan Tindak Pidana Pencucian Uang
status: berlaku            # berlaku | diubah | dicabut | tidak_berlaku
tanggal_penetapan: YYYY-MM-DD
tanggal_pengundangan: YYYY-MM-DD
nomor_pengundangan: "LN …"
nomor_tambahan: "TLN …"
pemrakarsa: …
source_url: https://peraturan.go.id/…
source_pdf_url: https://peraturan.go.id/…
pdf_sha256: …
archive_url: https://archive.org/…
pdf_quality: born_digital  # born_digital | scanned_clean | image_only
parser_version: 1
relationships:
  amended_by: []
  revokes: []
---
```

(Values shown are placeholders. Fill them from the source, never by hand.)

Body conventions, chosen so diffs stay clean:
- `## BAB I` (title on the next line), `### Bagian Kesatu`, `#### Paragraf 1`, `#### Pasal 5 {#pasal-5}` with stable anchors.
- **One ayat or list item per line** (semantic line breaks), so a changed ayat shows up as a one-line diff.
- Penjelasan in its own section at the end, with matching anchors (`{#penjelasan-pasal-5}`).

### 6.3 RUU tracker record (`ruu.yaml`)

```yaml
id: ruu/perampasan-aset
title: RUU tentang Perampasan Aset Terkait Tindak Pidana Korupsi dan Tindak Pidana Lainnya
former_titles:
  - RUU tentang Perampasan Aset Terkait Dengan Tindak Pidana
initiator: DPR              # was a government bill in 2023
dpr_page: https://www.dpr.go.id/…--707
stages:
  - { stage: pembicaraan_tingkat_ii, date: 2026-11-19, note: "Disetujui rapat paripurna" }
documents:
  - type: draft_ruu_final
    date: 2026-11-19
    provenance: official       # official | media | archive | leak
    obtained_by: DPR
    source_url: https://berkas2.dpr.go.id/akd/dokumen/komisi3-RJ-20261119-043602-5251.pdf
    sha256: …
    archive_url: …
    text: versions/2026-11-19-draft-final.md
enacted_as: null             # set to /akn/id/act/uu/2026/N once numbered
```

`provenance` is mandatory and shown prominently on the site. Never present a media or leaked copy as official.

---

## 7. Legal notes

- **Enacted law and court decisions have no copyright.** UU 28/2014 (Hak Cipta) Pasal 42: no copyright on `peraturan perundang-undangan`, `putusan pengadilan`, results of open state-institution meetings, and state speeches.
- **Drafts (RUU, NA, DIM) are less clear-cut** but very likely fine: Pasal 43 says publishing material produced by or on behalf of the government is not infringement unless it is declared protected.
- UU 12/2011 Pasal 96(4) (as amended) requires every draft regulation to be easily accessible to the public. That's the public-interest basis for the RUU tracker.
- License the data repo **CC0**.

---

## 8. Website

- **Astro**, static output, built by GitHub Actions on every push to the data repo (`repository_dispatch` from the scraper, or a schedule).
- UI language: **Indonesian first**, English second. Legal text always stays in Indonesian.
- Pages:
  - Law page: readable structure, table of contents, status badge, source links, version history.
  - RUU page: stage timeline, list of all versions with provenance badges, document downloads (links to source and archive copies).
  - **Diff view** between any two versions. Diff per pasal at word level (e.g. `diff`/jsdiff at build time). Pasal numbers shift between drafts, so match pasal by content similarity, not just by number.
- **Search:** Pagefind (`npx pagefind --site dist`) after the build. If the site outgrows static limits, switch to SQLite FTS5 built from git and queried in the browser with HTTP range requests (e.g. sql.js-httpvfs), split into chunks under the host's per-file limit.
- Hosting: GitHub Pages or Cloudflare Pages. Domain: ask Dante (a subdomain of `suarakami.id` is pending the group's approval).

---

## 9. Milestones

**M0: Setup**
- Create both repos, licenses, README, folder layout, Python and Astro scaffolds, CI skeleton.

**M1: One RUU end-to-end (test case: RUU Perampasan Aset, §10)**
- `ruu.yaml` lists every known version with provenance, including versions we know exist but have no file for (`file: null` plus a note).
- Markdown text for at least the 2023 government draft and the 2026-11-19 final draft.
- Site renders the RUU page and a pasal-level diff between those two.
- Done when: the site builds in CI and the diff correctly shows that Pasal 5(2) changed between the two versions.

**M2: All RUUs from the DPR site**
- Discover all RUUs from the DPR legislation pages, record stages and documents, download through the Indonesian IP, archive, commit. Daily run.

**M3: All UU from peraturan.go.id**
- Listing → detail metadata → PDF → parser → Markdown. Mark image-only PDFs for OCR.

**M4: Public MVP**
- Search, law pages, RUU pages, diffs, provenance badges, deploy.

**Later**
- OCR backlog, amendment relationships, PP/Perpres (phase 2), BPK via headless browser, consolidated "current text" of amended laws (applying amendment instructions; the hard part, and nobody does it yet), plain-language summaries (clearly marked as AI-generated, always linking to the source pasal), optional database for live features.

---

## 10. Test case data: RUU Perampasan Aset

Status as of 2026-11-20: approved by the DPR plenary on **19 Nov 2026**; awaiting the President's signature and a UU number. The official numbered text will appear on peraturan.go.id / JDIH once it is published in the Lembaran Negara.

Timeline:
- 2008: first drafted (PPATK). 2012: BPHN naskah akademik.
- 4 May 2023: government sends its draft to the DPR by Surat Presiden.
- 15 Jan 2026: Badan Keahlian DPR presents its first draft (reported as 62 pasal).
- 6 Oct 2026: approved as a DPR initiative bill.
- 5 Nov 2026: government delivers its DIM.
- 18 Nov 2026: Tingkat I. 19 Nov 2026: Tingkat II, passed.
- The title changed from "…Terkait Dengan Tindak Pidana" to "…Terkait Tindak Pidana Korupsi dan Tindak Pidana Lainnya".

Known documents (**official DPR files need an Indonesian IP**):

| Date | Document | Provenance | URL |
|---|---|---|---|
| 2012 | BPHN NA (penyelarasan) | official | https://bphn.go.id/data/documents/hasil_penyelarasan_na_ruu_tentang_perampasan_aset.pdf (503 on 2026-11-20). Text copy: https://id.wikisource.org/wiki/Laporan_Hasil_Penyelarasan_Naskah_Akademik_Rancangan_Undang-Undang_tentang_Perampasan_Aset_Tindak_Pidana |
| 2022 | Kemenkumham NA | official, removed | was https://jdih.ppatk.go.id/produk-hukum/detail/220/naskah-akademik-rancangan-undang-undang-tentang-perampasan-aset-terkait-tindak-pidana (now 404; try Wayback) |
| 2023 | Government draft, 68 pasal, 7 BAB (undated file) | archive | https://web.archive.org/web/20251106052153/https://jdih.ppatk.go.id/storage/dokumen_produk_hukum/Draft%20Final%20RUU%20Perampasan%20Aset%20.pdf |
| 2026-01-15 | Naskah Urgensi (BKD) | official | https://berkas2.dpr.go.id/akd/dokumen/komisi3-RJ-20260204-012838-6841.pdf |
| 2026-01-15 | Dokumen Pendukung Lain from the BKD progress meeting (probably draft materials; unopened) | official | https://berkas2.dpr.go.id/akd/dokumen/komisi3-RJ-20260327-050629-8842.PDF (104.7 MB), https://berkas2.dpr.go.id/akd/dokumen/komisi3-RJ-20260327-050554-1623.pdf (6.8 MB) |
| posted 2026-11-09 | Draft RUU (DPR initiative version the DIM responds to) | official | https://berkas2.dpr.go.id/akd/dokumen/komisi3-RJ-20261109-095417-4352.PDF |
| posted 2026-11-09 | DIM (4 files) | official | `komisi3-RJ-20261109-125541-1270.PDF`, `komisi3-RJ-20261109-125757-1462.PDF`, `komisi3-RJ-20261109-010055-6545.PDF`, `komisi3-RJ-20261109-010826-7859.PDF` (all under https://berkas2.dpr.go.id/akd/dokumen/) |
| posted 2026-11-18 | Draft NA | official | https://berkas2.dpr.go.id/akd/dokumen/komisi3-RJ-20261118-043615-2162.pdf |
| posted 2026-11-18 | Surat Presiden | official | https://berkas2.dpr.go.id/akd/dokumen/komisi3-RJ-20261118-054100-6707.pdf |
| 2026-11-18 | Tingkat I: Laporan Komisi / Tanggapan Pemerintah | official | `komisi3-RJ-20261118-053224-5367.pdf` / `komisi3-RJ-20261118-053905-8340.pdf` |
| 2026-11-19 | **Draft RUU Final** (text approved by plenary) | official | https://berkas2.dpr.go.id/akd/dokumen/komisi3-RJ-20261119-043602-5251.pdf |
| 2026-11-19 | Tingkat II: Laporan Komisi / Tanggapan Pemerintah / Dokumen Pendukung Lain | official | `paripurna-RJ-20261119-011012-3416.pdf` / `paripurna-RJ-20261119-011119-4062.pdf` / `komisi3-RJ-20261119-043029-2147.pdf` |
| 2026-11-18 | 74-pasal draft "after Timus/Timsin" | media (Kumparan) | https://drive.google.com/file/d/1fuzGBBDN4b92PZfeXxLK8E_gE_gNSlY8/view |

Versions known to exist but with **no file found**: PPATK 2008 original; BKD January 2026 draft (62 pasal); DPR draft before the initiative vote (66 pasal, 9 BAB); drafts of 10 July 2026 and August 2026 (only quoted in civil-society and Katadata reporting).

**Trap:** a file circulated as "Draft Final RUU Perampasan Aset" with a name dated 30 Aug 2026 is actually the **2023 government draft** (PDF metadata 10 May 2023). Tirto's August 2026 "draf final" link also points to the 2023 PPATK file. Always check PDF metadata and content before labelling a version.

Expected key difference for the M1 diff check: in the 2023 government draft, Pasal 5(2)(a) allows seizing assets disproportionate to income whose lawful origin cannot be proven ("unexplained wealth"). Reporting says the DPR version narrowed this to convicted offenders. Verify against the actual texts.

Other useful page: DPR library collection for this RUU: https://perpustakaan.dpr.go.id/sipinter/index/detail/id/225

---

## 11. Open questions for Dante

1. Repo names and GitHub org/user.
2. Scraper host: dm1 + Indonesian VPN, or a small Indonesian VPS?
3. Domain: `suarakami.id` subdomain (pending group approval) or a separate domain?
4. GitHub Pages or Cloudflare Pages?
5. Confirm licenses: data CC0, code AGPL-3.0.

## 12. Ground rules

- Don't scrape pasal.id. Don't commit PDFs. Don't rewrite data-repo history.
- Every document carries provenance. Never fabricate or "reconstruct" a missing version.
- Be polite to government servers (rate-limit, cache, identify yourself).
- Treat everything marked **(verify)** as a hypothesis until checked.
