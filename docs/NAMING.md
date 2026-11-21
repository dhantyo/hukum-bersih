# Naming rule

Agreed with Dante on 2026-11-20 after looking at Switzerland (Fedlex) and Germany (NeuRIS).
This rule applies everywhere: archive.org, files in `data/`, ids in YAML, and site URLs.
It replaces the example file names in `docs/BRIEF.md` §6.

## Three names per document

| Name | For | Example |
|---|---|---|
| **id** | machines: archive.org, file names, links between records | `uu_11_2008` |
| **title** | people: the official citation, in Indonesian | Undang-Undang Nomor 11 Tahun 2008 tentang Informasi dan Transaksi Elektronik |
| **short name** | search: the popular name, when one exists | UU ITE |

Ids never contain the project name. The project is mentioned only in archive.org descriptions.

## Id format

- Lowercase ASCII letters, digits, `-` and `_` only.
- `_` separates the parts. `-` joins words inside one part (`perampasan-aset`, `draft-final`).
- Dates are ISO, `YYYY-MM-DD`, or only as precise as known (`2023-05`, `2008`).
- Number before year, the way Indonesians cite laws ("UU 8/2010").

### Regulations

| What | Pattern | Example |
|---|---|---|
| The regulation (the "work") | `<jenis>_<nomor>_<tahun>` | `uu_11_2008`, `perppu_2_2022`, `pp_35_2021` |
| One text version | `<work id>_<date it took effect>` | `uu_11_2008_2008-04-21` |

- Numbering restarts every year and differs per type, so type + number + year is always unique
  (`uu_1_1974`, `uu_1_2023`, `uu_1_2024` and `perppu_1_2020` are four different laws).
- Every text version is dated, including the latest; there is no undated "current" text.
  The original is dated by when it took effect (normally *tanggal diundangkan*). A consolidated
  text is dated by when the last amendment it includes took effect.
- When the source splits one version into several files (e.g. the body and a lampiran), the
  first file has the version id and the others add `_<n>`: `uu_6_2023_2023-03-31_2`.
  The same applies when a second copy of a version (another source's PDF) is archived.
- An amendment is its own regulation with its own id (`uu_19_2016` amends `uu_11_2008`).
- Types: `uu`, `perppu`, `pp`, `perpres`, `keppres`, `inpres`, `tap-mpr`; ministerial and
  agency regulations use the standard abbreviation (`permenkeu`, `permenkumham`, …).
  Older formats keep a type prefix: `uu-drt_7_1955`, `pnps_1_1965`.
- If an official number carries a letter suffix, the suffix stays part of the number.
- The Akoma Ntoso id (`/akn/id/act/uu/2008/11`) is kept as an internal `akn` field for
  data exchange; it is never shown to readers.

### RUU documents

`ruu_<slug>_<date>_<type>[_<who>][_<n>]`, e.g. `ruu_perampasan-aset_2026-11-19_draft-final`.

- `<slug>`: the bill's folder name under `data/ruu/` (short topic). One slug per bill, kept
  when the title changes. The DPR page id is stored in `ruu.yaml`, not in ids.
- `<date>`: the document's own date if known, otherwise the date it was posted.
- `<who>`: only when needed to tell documents apart: `pemerintah`, `dpr`, `bkd`, a media name.
- `<n>`: `1`, `2`, … when one entry has several files (a DIM split into four PDFs).
- Versions known to exist but never found still get an id.

| `<type>` | DPR label (`menuAkd.title`) | Our label (DPR's wording, KBBI spelling) |
|---|---|---|
| `draft` | Draft RUU | Draf RUU |
| `draft-final` | Draft RUU Final | Draf RUU Final |
| `naskah-akademik` | Draft NA | Naskah Akademik |
| `naskah-urgensi` | Naskah Urgensi | Naskah Urgensi |
| `dim` | Daftar Inventaris Masalah (DIM) | Daftar Inventaris Masalah (DIM) (short: DIM) |
| `surat-presiden` | Surat Presiden | Surat Presiden |
| `laporan-komisi` | Laporan Komisi | Laporan Komisi |
| `tanggapan-pemerintah` | Tanggapan Pemerintah | Tanggapan Pemerintah |
| `pandangan-mini-fraksi` | Pandangan Mini Fraksi | Pandangan Mini Fraksi |
| `risalah-rapat` | Risalah Rapat | Risalah Rapat |
| `laporan-singkat` | Laporan Singkat | Laporan Singkat |
| `bahan-narasumber` | Bahan Narasumber | Bahan Narasumber |
| `dokumen-pendukung` | Dokumen Pendukung Lain | Dokumen Pendukung |

## Where names appear

### Repository

```
data/peraturan/uu/2008/uu_11_2008/
  uu_11_2008.yaml                 details: title, short name, status, relationships, versions
  uu_11_2008_2008-04-21.txt       text as enacted (Bluebell / Akoma Ntoso)
  uu_11_2008_2024-01-02.txt       (later) consolidated text, marked unofficial
data/ruu/perampasan-aset/
  ruu.yaml
  versions/ruu_perampasan-aset_2026-11-19_draft-final.txt
```

Year folders keep every folder small (GitHub's file browser stops at 1,000 entries).

### archive.org

Titles put the identifying words first, because archive.org cards cut titles off after
about 40 characters. Titles and descriptions can be rewritten later without re-uploading
(`hukum-bersih archive-retitle`, "Retitle archive.org items" workflow).

Only original source files (PDFs) go to archive.org. Our consolidated texts do not.

| | Regulation | RUU document |
|---|---|---|
| Item identifier | work id: `uu_11_2008` | document id: `ruu_perampasan-aset_2026-11-19_draft-final` |
| File in the item | version id: `uu_11_2008_2008-04-21.pdf` | `ruu_perampasan-aset_2026-11-19_draft-final.pdf` |
| Title (short, shown on cards) | `<short name> – <citation>`, e.g. UU ITE – Undang-Undang Nomor 11 Tahun 2008 | `<bill short name> – <short label> (<date>)`, e.g. RUU Perampasan Aset – Draf RUU Final (19 November 2026) |
| Description | full title with "tentang …", source URL, original file name, one line about the project | full label + the bill's title as it was then, source URL, original file name, project line |

If the source later publishes a different file for the same version, it goes into the same item
with the fetch date appended. If an identifier is already taken by someone else on archive.org,
the upload fails and a variant is chosen by hand; nothing is ever overwritten.

### Website

| Page | URL |
|---|---|
| Regulation (latest version) | `/uu/11/2008` |
| One version | `/uu/11/2008/2016-11-25` |
| Compare versions | `/uu/11/2008/beda/2008-04-21...2024-01-02` |
| RUU | `/ruu/perampasan-aset` |
| RUU document | `/ruu/perampasan-aset/ruu_perampasan-aset_2026-11-19_draft-final` |

## Worked examples

**UU ITE.** `uu_11_2008` (`short_name: UU ITE`, `status: diubah`,
`amended_by: [uu_19_2016, uu_1_2024]`) with versions `uu_11_2008_2008-04-21` (official),
`uu_11_2008_2016-11-25` and `uu_11_2008_2024-01-02` (our consolidations, labelled unofficial).

**Cipta Kerja.** `uu_11_2020` (`dicabut`, `revoked_by: perppu_2_2022`) →
`perppu_2_2022` (`revokes: uu_11_2020`, `enacted_as: uu_6_2023`) →
`uu_6_2023` (`enacts: perppu_2_2022`). All three share `short_name: UU Cipta Kerja`.

**RUU to UU.** `ruu.yaml` gets `enacted_as: uu_<n>_<year>`; the new regulation gets
`from_ruu: ruu/<slug>`.
