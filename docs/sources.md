# Upstream sources

What we know about each site we read, and from where it answers. Dated, newest facts win. The code that reads each site is in `pipeline/src/hukum_rapih/sources/`.

## peraturan.bpk.go.id (main source since 2026-11-21)

- Sits behind a Cloudflare managed challenge ("Verify you are human", 403). It is not geo-blocked.
- Scrapling `StealthyFetcher` with a real Chrome under xvfb passes it from GitHub runners (2026-11-21). The `cf_clearance` cookie and the browser's user agent then work in `curl_cffi` for detail pages and PDFs. `sources/bpk_session.py` reuses one clearance per workflow run. Plain Playwright, SeleniumBase UC and Camoufox failed on the same runners.
- Browser tests against Cloudflare are meaningless from the Claude cloud container: its proxy re-terminates TLS, so every browser has a non-Chrome fingerprint.
- Listing pages, page size and the `jenis` codes per regulation type are in `sources/peraturan_bpk.py`. Detail pages give tanggal pengundangan and berlaku, LN/TLN, subjek, Uji Materi, and status with notes.
- BPK's retyped copies of old laws seem to use modern spelling (UU 6/1964 "yang" for "jang", UU 30/1947 "Yogyakarta" for "Jogjakarta"). BPK's UU 19/1997 names SOEHARTO under the State Secretary too, likely a retyping error. Kept as printed, pending a lawyer's review.
- BPK has an Android app (`id.go.bpk.jdih.pro`) that may use an API. The APK was never obtained (APKPure blocked from runners, Google Play needs a login).
- A formal KIP request to BPK's PPID is the other route to the files.

## Hugging Face mirror `Azzindani/ID_REG`

- Apache-2.0. About 267,000 regulation PDFs scraped from peraturan.bpk.go.id around April 2025, in zips of about 1,000 PDFs, named with BPK's file names (spaces as `_`).
- Files checked against BPK downloads were byte-identical (3 of 3, 2026-11-21). Single files are read by HTTP range request (`remotezip`), with no Cloudflare.
- The importer falls back to it when a BPK download fails (`data/sources/mirrors/id_reg.json`). Nothing after about April 2025 is in it.
- `Azzindani/ID_REG_Parsed` (one row per pasal, no ayat, lists or Penjelasan) is only useful as a cross-check.

## peraturan.go.id (earlier imports)

- Run by the Direktorat Jenderal Peraturan Perundang-undangan, Kementerian Hukum (not "JDIH Kementerian Hukum").
- Answers only Indonesian IPs, and the block is switched on and off (2026-11-21, check-host.net from 40 locations: only Jakarta answered; it had worked from the US the evening before). `import-peraturan.yml` works only while the site lets other IPs in.
- Use HTTP/1.1; HTTP/2 got a reset once.
- Gives "01 Januari 1970" as tanggal penetapan for some laws. The importer reads it as unknown.
- About 1,900 of its PDFs were downloaded on 2026-11-20 and 21 without being kept; only their sha256 is in the manifest. BPK's copy is used instead.

## Other hosts (2026-11-20 and 21)

| Host | From a GitHub runner (US) | From the Claude container |
|---|---|---|
| `berkas2.dpr.go.id` | 206 for PDFs | 403 |
| `www.dpr.go.id`, `berkas.dpr.go.id/jdih` | 403 | 403 |
| `jdih.go.id`, `jdih.setkab.go.id` | time out (Indonesian IPs only) | time out |
| `jdih.esdm.go.id` | 301 | |
| `web.archive.org`, `archive.org` | 200 | connection reset |

These came from `probe-sources.yml`, removed 2026-11-24. To re-check, restore it from git history (7f6dcaed).
