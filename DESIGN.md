# Design

Hukum Bersih is a public service: Indonesian law as clean, readable text, and draft bills (RUU)
with every version and what changed. It should feel like a calm, trustworthy reference work:
closer to a well-made official gazette than to a startup. Indonesian first.

Direction taken from legislation.gov.uk, Fedlex (Switzerland), the GOV.UK design system and
La Fabrique de la Loi (looked at 2026-11-21): metadata panel beside the text, breadcrumbs,
version timeline, table of contents, prominent search, white page, one link color, status
colors. Not copied: no logos, crests or brand assets of those sites.

Tokens live in `web/src/styles/tokens.css`; components use the names, never raw values.

## Color

| Token | Light | Dark | Role |
|---|---|---|---|
| `--bg` | `#ffffff` | `#111418` | page |
| `--bg-subtle` | `#f5f6f7` | `#181c21` | side panels, table heads, code |
| `--surface` | `#ffffff` | `#1c2127` | cards on subtle backgrounds |
| `--text` | `#1b1f24` | `#e6e8eb` | body text (15.9:1 / 14.6:1) |
| `--text-muted` | `#59616b` | `#a3abb5` | meta, captions (6.3:1 / 7.6:1) |
| `--line` | `#dde1e5` | `#2d343c` | borders, rules |
| `--primary` | `#1d4f91` | `#8cb4f0` | links, buttons, focus, current nav (7.9:1 / 8.6:1) |
| `--primary-bg` | `#e8f0fa` | `#1a2a40` | selected items, highlights |
| `--ok` | `#17683a` | `#6fcf97` | *berlaku*, *Resmi* |
| `--warn` | `#8a5a00` | `#e7b75f` | *diubah*, *berubah*, low confidence |
| `--gone` | `#6b7280` | `#9aa3ad` | *dicabut*, *tidak berlaku*, not found |
| `--ins-bg` / `--ins-text` | `#e3f4e8` / `#14532d` | `#163a24` / `#b9ecc8` | inserted text in comparisons |
| `--del-bg` / `--del-text` | `#fbe4e4` / `#7f1d1d` | `#43201f` / `#f6c3c0` | deleted text in comparisons |

No brand red: in this product red means "deleted". No gradients.

## Typography

- **Public Sans** (variable): interface, headings, navigation, metadata. A public, open
  government typeface.
- **Source Serif 4** (variable): the legal text itself (pasal, ayat, penjelasan), so the law
  reads like a document and the interface like a tool.
- Readers can change the law-text font and size with the "Aa" control in the header
  (`components/ReadingSettings.astro`, stored in their browser): Source Serif 4 (default),
  Literata, Public Sans, Atkinson Hyperlegible Next; size normal or large. Components keep
  using `--font-law` / `--fs-law`, which the choice overrides.

| Token | Size / line height | Use |
|---|---|---|
| `--fs-xs` | 13px / 1.4 | badges, fine print |
| `--fs-sm` | 14.5px / 1.5 | metadata, captions, panels |
| `--fs-base` | 16px / 1.6 | interface text |
| `--fs-law` | 17.5px / 1.65 | legal text (serif), measure ≤ 70ch |
| `--fs-lg` | 20px / 1.4 | section headings (h2) |
| `--fs-xl` | 26px / 1.25 | page titles on small screens |
| `--fs-2xl` | 32px / 1.2 | page titles (h1) |

Weights: 400 text, 600 headings and labels, 700 only for the site name (`--fs-lg`).

## Spacing and layout

4px base: `--s-1` 4, `--s-2` 8, `--s-3` 12, `--s-4` 16, `--s-5` 24, `--s-6` 32, `--s-7` 48,
`--s-8` 64; `--s-0` 2 only for the vertical padding of pills. `--tap` 44px: minimum size of
anything tapped (buttons, the "Aa" control). Page width 72rem; reading column 42rem; side panel 17rem. Phone gutter 16px.

Document pages: breadcrumbs, title block, then two columns: side panel (status, facts, versions,
table of contents; sticky) and the text. Below 960px the panel comes first, collapsed.

## Shape and depth

Radius `--r-sm` 4px (badges, inputs, buttons), `--r-md` 8px (cards, panels). No shadows except
`--shadow-pop` for the search dropdown. Borders do the separating.

## Components

- **Header**: site name, main nav (Peraturan · RUU · Tentang), search field on every page.
- **Breadcrumbs**: muted, `›` separated.
- **Status badge**: small pill, colored text and border, no fill (berlaku/diubah/dicabut;
  Resmi/Arsip/Media/Belum ditemukan).
- **Status banner** (law pages, above the text): a repealed law says "sudah tidak berlaku" and
  links to what repealed it (border `--gone`); an amended law says the text is the original
  wording and links to the pasal-by-pasal changes (border `--warn`). Pattern from
  legislation.gov.uk and Fedlex. `components/StatusBanner.astro`.
- **Contents button** (phones, document pages): "Daftar isi ↑", fixed bottom-right once the side
  panel has scrolled away; opens the panel at the current section (GOV.UK back-to-top pattern).
- **Fact list** (side panel): label above value, `--fs-sm`.
- **Table of contents**: BAB headings with their pasal range; current item marked with
  `--primary` left border.
- **Law text**: serif, hanging numbers for ayat/huruf/angka. Two formats, chosen by the reader
  ([decision 0009](docs/decisions/0009-law-view-asli-modern.md)); the text is the same, only
  the layout changes:
  - *Modern* (default): headings left-aligned in the interface font and normal capitals
    ("Bab I  Ketentuan Umum", number muted; Bagian smaller, Paragraf muted; "Pasal 5"),
    a thin rule above each BAB, no boxes. Pembukaan folded to one line with what it contains
    ("Menimbang (7) · Mengingat"); the closing under "Pengesahan dan pengundangan".
  - *Asli*: as the official copy: title, BAB and Pasal centred in capitals, Pembukaan open.
  - BAB, Bagian, Paragraf and Pasal headings are buttons that fold their content; the arrow
    hangs in the left margin (before the heading on narrow screens). A folded pasal shows its
    first words. Folded content uses `hidden="until-found"` so find-in-page still finds it.
  - Penjelasan at the end, under each pasal (thin left rule, interface type, label
    "Penjelasan"), or hidden; "Cukup jelas" can be hidden; labels "Ayat (1)", "Huruf d",
    "Angka 3" shown as (1), d., 3. in Modern.
  - Each pasal has a short anchor `#pasal-27` (first pasal with that number) beside its Akoma
    Ntoso eId; "#" after the heading links to it (on hover; always on touch screens).
  - Long laws use `content-visibility: auto` per chapter. Print: text, title and status banner
    only, always light, everything unfolded.
- **Reading settings ("Aa" in the header)**: one popover for how text is shown. Every page:
  font and size. Pages with a law or draft text add, first: Format (Modern/Asli, option rows
  like the fonts), Penjelasan (chips: Di akhir / Per pasal / Sembunyi, and "Tampilkan Cukup
  jelas"), Bagian yang ditampilkan (chips: Pembukaan, Batang tubuh, Penutup). Option rows and
  chips are native radios/checkboxes; the checked one gets `--primary-bg`. Remembered in the
  browser (`hb-font`, `hb-size`, `hb-view`), applied before first paint.
- **Table of contents**: "Tutup semua · Buka semua" as quiet links beside its title; closing
  everything turns the text into an outline of BAB and Pasal.
- **Synopsis (comparison)**: two columns, old left, new right, one row per pasal pair;
  deletions `--del-*`, insertions `--ins-*`; one inline column on phones.
- **Buttons**: primary (filled `--primary`), secondary (outline), quiet (text). Focus: 3px
  outline `--primary` with 2px offset, always visible on keyboard focus.
- **Lists of laws**: rows, not cards: title, number/year, status badge, one line of meta.

## Imagery and icons

No photos or illustrations. Icons only where they carry meaning (external link, PDF, search),
inline SVG at 16px, `currentColor`.
