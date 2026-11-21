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

| Token | Size / line height | Use |
|---|---|---|
| `--fs-xs` | 13px / 1.4 | badges, fine print |
| `--fs-sm` | 14.5px / 1.5 | metadata, captions, panels |
| `--fs-base` | 16px / 1.6 | interface text |
| `--fs-law` | 17.5px / 1.65 | legal text (serif), measure ≤ 70ch |
| `--fs-lg` | 20px / 1.4 | section headings (h2) |
| `--fs-xl` | 26px / 1.25 | page titles on small screens |
| `--fs-2xl` | 32px / 1.2 | page titles (h1) |

Weights: 400 text, 600 headings and labels, 700 only for the site name.

## Spacing and layout

4px base: `--s-1` 4, `--s-2` 8, `--s-3` 12, `--s-4` 16, `--s-5` 24, `--s-6` 32, `--s-7` 48,
`--s-8` 64. Page width 72rem; reading column 42rem; side panel 17rem. Phone gutter 16px.

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
- **Fact list** (side panel): label above value, `--fs-sm`.
- **Table of contents**: BAB headings with their pasal range; current item marked with
  `--primary` left border.
- **Law text**: serif, hanging numbers for ayat/huruf/angka, pasal headings centered small caps
  style (600, letter-spacing), anchor link on hover.
- **Synopsis (comparison)**: two columns, old left, new right, one row per pasal pair;
  deletions `--del-*`, insertions `--ins-*`; one inline column on phones.
- **Buttons**: primary (filled `--primary`), secondary (outline), quiet (text). Focus: 3px
  outline `--primary` with 2px offset, always visible on keyboard focus.
- **Lists of laws**: rows, not cards: title, number/year, status badge, one line of meta.

## Imagery and icons

No photos or illustrations. Icons only where they carry meaning (external link, PDF, search),
inline SVG at 16px, `currentColor`.
