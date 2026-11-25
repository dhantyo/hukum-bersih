# Design

Hukum Bersih is a public service: Indonesian law as clean, readable text, and draft bills (RUU)
with every version and what changed. It should feel like a calm, trustworthy reference work:
closer to a well-made official gazette than to a startup. Indonesian first.

Direction taken from legislation.gov.uk, Fedlex (Switzerland), the GOV.UK design system and
La Fabrique de la Loi (looked at 2026-11-21): metadata panel beside the text, breadcrumbs,
version timeline, table of contents, prominent search, white page, one link color, status
colors. Not copied: no logos, crests or brand assets of those sites.

Tokens live in `web/src/styles/tokens.css`; components use the names, never raw values. The Solid app (`web-solid/`) keeps the same values as literal StyleX tokens in `web-solid/src/styles/tokens.stylex.ts`; change both together until the Astro app is retired.

## Color

| Token | Light | Dark | Role |
|---|---|---|---|
| `--bg` | `#ffffff` | `#111418` | page |
| `--bg-subtle` | `#f5f6f7` | `#181c21` | side panels, table heads, code |
| `--surface` | `#ffffff` | `#1c2127` | cards on subtle backgrounds |
| `--text` | `#1b1f24` | `#e6e8eb` | body text (15.9:1 / 14.6:1) |
| `--text-muted` | `#59616b` | `#a3abb5` | meta, captions (6.3:1 / 7.6:1) |
| `--line` | `#dde1e5` | `#2d343c` | borders, rules |
| `--line-strong` | `#808993` | `#69727d` | edges of controls: inputs, buttons, chips, "Aa" (3.6:1 / 3.8:1 on `--bg`; WCAG 1.4.11 asks 3:1) |
| `--primary` | `#1d4f91` | `#8cb4f0` | links, buttons, focus, current nav (7.9:1 / 8.6:1) |
| `--primary-bg` | `#e8f0fa` | `#1a2a40` | selected items, highlights |
| `--ok` | `#17683a` | `#6fcf97` | *berlaku*, *Resmi* |
| `--warn` | `#8a5a00` | `#e7b75f` | *diubah*, *berubah*, low confidence |
| `--gone` | `#6b7280` | `#9aa3ad` | *dicabut*, *tidak berlaku*, not found |
| `--ins-bg` / `--ins-text` | `#e3f4e8` / `#14532d` | `#163a24` / `#b9ecc8` | inserted text in comparisons |
| `--del-bg` / `--del-text` | `#fbe4e4` / `#7f1d1d` | `#43201f` / `#f6c3c0` | deleted text in comparisons |
| `--mod-bg` / `--mod-text` | `#fbefd5` / `#6b4400` | `#3d2f12` / `#f3d9a4` | reworded text in comparisons (Fedlex "modified"; 7.5:1 / 9.5:1) |

No brand red: in this product red means "deleted". No gradients.

## Typography

- **Public Sans** (variable): interface, headings, navigation, metadata. A public, open
  government typeface.
- **Source Serif 4** (variable): the legal text itself (pasal, ayat, penjelasan), so the law
  reads like a document and the interface like a tool.
- The law-text face depends on the format (decision 0009): **Atkinson Hyperlegible Next** in
  Modern (the default), **Source Serif 4** in Asli. Readers can change it with the "Aa" control
  in the header (`components/ReadingSettings.astro`, stored in their browser), separately for
  each format: Source Serif 4, Literata, Public Sans, Atkinson Hyperlegible Next; size normal
  or large (shared). Components keep using `--font-law` / `--fs-law`, which the choice
  overrides.
- The table of contents always uses Modern labels ("Bab I · Ketentuan Umum"): it is
  navigation, not the law text.

| Token | Size / line height | Use |
|---|---|---|
| `--fs-xs` | 13px / 1.4 | badges, fine print |
| `--fs-sm` | 14.5px / 1.5 | metadata, captions, panels |
| `--fs-base` | 16px / 1.6 | interface text |
| `--fs-law` | 17.5px / 1.65 | legal text (serif), measure ≤ 70ch |
| `--fs-md` | 17.5px | sub-headings in law text (Bagian, Penjelasan's "Umum") |
| `--fs-lg` | 20px / 1.4 | section headings (h2) |
| `--fs-xl` | 26px / 1.25 | page titles on small screens |
| `--fs-2xl` | 32px / 1.2 | page titles (h1) |

Weights: 400 text, 600 headings, labels and `<strong>`, 500 only for the main navigation,
700 only for the site name (`--fs-lg`).

Hierarchy, checked against the rendered pages (2026-11-21): interface pages use page title
`--fs-2xl` · section heading `--fs-lg` · item title (law rows, cards) `--fs-base`/`--fs-md`
600 · text `--fs-base` · meta `--fs-sm` · labels `--fs-xs`. Law text has its own scale,
anchored on the text (see "Law text").

## Spacing and layout

4px base: `--s-1` 4, `--s-2` 8, `--s-3` 12, `--s-4` 16, `--s-5` 24, `--s-6` 32, `--s-7` 48,
`--s-8` 64; `--s-0` 2 only for the vertical padding of pills. `--tap` 44px: minimum size of
anything tapped (buttons, the "Aa" control). Page width 72rem (`--page`; 100rem `--page-wide` while comparing versions); reading column 42rem; side panel 17rem; hanging numbers 2.4rem (`--hang`, 1.9rem `--hang-sm` on phones). Phone gutter 16px.

Document pages: breadcrumbs, title block, then two columns: side panel (Versi, table of
contents, facts; sticky) and the text (`components/DocLayout.astro`). On wide screens the
reader can hide the panel ("Sembunyikan"): a slim strip with a "›" button stays and the text
column centres; remembered (`hb-panel`, applied before first paint). Up to 960px the panel is a
drawer from the left over the text (`--scrim` behind it), opened from a slim chevron tab on the
left edge (16px wide, 44px touch target): tap it, or pull it right and the drawer follows the
finger; push the drawer left to close. Past a third of its width or a flick it opens / closes,
otherwise it goes back. Escape, the scrim or a link also close it; the page behind is inert.

The site header follows the scroll like a phone browser's address bar (behaviour from Sapu
Berita, `lib/barscroll.ts`): scrolling down it leaves with the page, scrolling up it comes back
by the distance scrolled up, and 140ms after the scroll stops a half-shown header settles fully
shown or hidden (0.24s ease-out; shown if the last movement was up). The browser moves it like
the text (it sits in the page, or is fixed at the top when fully back), never script per frame,
which lags the page on phones. It stays while "Aa" is open or focus is in it, and tucks away
after a jump within the page. Sticky things below it (side panel, comparison bar) sit at
`--header-shown`: its height while pinned, else 0.

## Shape and depth

Radius `--r-sm` 4px (badges, inputs, buttons), `--r-md` 8px (cards, panels). No shadows except
`--shadow-pop` for floating things (popovers, the phone drawer and its button). Borders do the
separating.

## Components

- **Header**: site name, main nav (Peraturan · RUU · Tentang), search field on every page.
- **Breadcrumbs**: muted, `›` separated.
- **Status badge**: small pill, colored text and border, no fill (berlaku/diubah/dicabut;
  Resmi/Arsip/Media/Belum ditemukan).
- **Status banner** (law pages, above the text): a repealed law says "sudah tidak berlaku" and
  links to what repealed it (border `--gone`); an amended law says the text is the original
  wording and links to the latest merged version (border `--warn`). Pattern from
  legislation.gov.uk and Fedlex. `components/StatusBanner.astro`.
- **Versi** (side panel, first; `components/Versions.astro`): every version of a law family,
  oldest first, like Fedlex's "All versions of this law": date, "Teks asli" / "Setelah UU
  3/2020", what it changed, "belum lengkap" when incomplete; dots `--ok` (in force), `--gone`
  (earlier), dashed (a known amendment we lack). The version on screen gets `--primary-bg`.
  Data: each record's `history` (decision 0010).
- **Merged text** (Koleksi page; `components/MergedView.astro`, decision 0010): the latest
  version of a law family, merged automatically; older versions at `/koleksi/<slug>/<date>/`.
  Same reading view as a law page. Above it a banner (`MergedBanner.astro`): "Teks gabungan per
  <date>, disusun otomatis", what it merges, "bukan teks konsolidasi resmi", and when incomplete
  (`--warn` border) exactly what is missing. Under each changed pasal: "Diubah oleh / Disisipkan
  oleh / Dihapus oleh UU n/yyyy"; a change whose wording could not be read keeps the previous text
  and says so (`--bg-subtle` tint).
- **Jump target**: the pasal a link jumped to gets `--primary-bg`, which fades out after about two
  seconds (it marks where you landed; it is not a selection).
- **Fact list** (side panel): label above value, `--fs-sm`.
- **Table of contents**: BAB headings with their pasal range; current item marked with
  `--primary` left border. The BAB being read opens to a grid of its pasal numbers (the pasal in
  view on `--primary-bg`); laws without BAB show the grid of all pasal. A "Ke pasal" box lists the pasal
  whose number starts with what is typed; picking one jumps to `#pasal-<n>`.
- **Law text**: serif, hanging numbers for ayat/huruf/angka. Two formats, chosen by the reader
  ([decision 0009](docs/decisions/0009-law-view-asli-modern.md)); the text is the same, only
  the layout changes:
  - *Modern* (default): headings left-aligned in the interface font and normal capitals, one
    token step per level, anchored on the text (17.5px; phones one step smaller):

    | Level | Desktop | Phone | vs text |
    |---|---|---|---|
    | BAB (rule above, number muted) | `--fs-xl` 26 | `--fs-lg` 20 | 1.5× |
    | Bagian (number muted) | `--fs-lg` 20 | `--fs-md` 17.5 | 1.1× |
    | Pasal, Penjelasan entry | `--fs-md` 17.5 | `--fs-base` 16 | 1× bold sans |
    | Paragraf (rare) | `--fs-md`, muted | `--fs-base`, muted | 1× |

    Set as `--h-bab`, `--h-bagian`, `--h-pasal` on `.law`. A heading sits closer to its first
    pasal than to the text before it,
    a thin rule above each BAB, no boxes. Pembukaan folded to one line with what it contains
    ("Menimbang (7) · Mengingat"); the closing under "Pengesahan dan pengundangan".
  - *Asli*: as the official copy: headings in the law's own serif at text size, bold, centred,
    capitals exactly as stored (never forced); Pembukaan open.
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
- **Comparing versions in place** (`components/CompareMode.astro`, decision 0010; replaces the
  Perubahan page). Always the whole law, and the reader stays put: "Diubah oleh UU 3/2020" under
  a pasal compares the version before that amendment with the one it made, keeping that pasal
  where it was on screen; "Bandingkan versi" (Versi panel) or `?bandingkan=<id>[&dari=<id>]`.
  Every changed pasal opens in place (a pasal the text lacks is placed after its neighbour);
  rows pair by ayat / item number, so "8. Dihapus." sits beside the old item 8.
  - Sticky bar: title, "n pasal berbeda", "Yang berubah saja", "Tutup"; under it one **module
    per column**, centred over it, joined by a rail (`--line-strong`), a round swap button in
    the middle. A module is a raised pill (`--shadow-sm`, `--r-md`) with a grip and the
    version's citation ("UU 3/2020", never "Teks asli" / "Setelah"). Drag a module across, or
    press swap: the columns slide with it; where they cross, the column not held fades.
  - Colours are chronological whichever side a version is on: inserted `--ins-*`, deleted
    `--del-*` struck, reworded `--mod-*` (struck on the older side), "Dihapus." in `--gone`
    italic, "tidak ada padanan" grey italic on `--bg-subtle`.
  - Contents: BAB with changes open, with counts per kind; pasal cells tinted `--ins-*`,
    `--del-*` (struck) or `--mod-*`. Marks are inline SVGs (`lib/marks.ts`: square with plus,
    minus, dot), never font glyphs.
  - Width: the page widens to `--page-wide`; unchanged text stays at `--measure`. From 1500px
    the side panel stays; 961–1499px it folds to its rail; up to 960px one inline column, no
    dragging.
  - Motion (motion.dev): springs (`visualDuration` 0.38, `bounce` 0.18) for drag, swap and
    changes growing out of the text they replace; quick ease-in (0.16s) for things leaving.
    Nothing animates under reduced motion.
- **Buttons**: primary (filled `--primary`), secondary (outline), quiet (text). Focus: 3px
  outline `--primary` with 2px offset, always visible on keyboard focus.
- **Lists of laws**: rows, not cards: title, number/year, status badge, one line of meta.

## Imagery and icons

No photos or illustrations. Icons only where they carry meaning (external link, PDF, search),
inline SVG at 16px, `currentColor`.
