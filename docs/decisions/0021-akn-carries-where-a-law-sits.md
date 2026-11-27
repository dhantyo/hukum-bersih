# 0021 The Akoma Ntoso file carries where a law sits

Date: 2026-11-28 · Decided by: the operator; change by Claude

## What

Each law's data says where the law sits: its dates, its relations to other laws, the MK rulings
on its provisions, its legal basis and the references in its text. The site only displays that
data with shared templates; it holds no text written for one law.

- YAML records and Bluebell texts in `data/` stay the source. The Akoma Ntoso file is made from
  them and is never stored in git (decision 0004).
- Derived links are worked out by the pipeline when it writes the export and the AKN, not stored
  in Bluebell: Penjelasan entries to the body down to ayat and huruf, inline references,
  Mengingat, and the "cukup jelas" flag. Bluebell stays as printed, and a better rule applies
  everywhere without rewriting `data/`.
- The feature list and the AKN element for each (lifecycle, temporalData, publication, TLC
  entries, active and passive modifications, `forceMod type="unconstitutionality"` and
  `meaningMod type="variation"` for MK rulings, `ref` and `TLCReference`) are in
  `docs/research-mk-relations-2026-11.md`.
- How a reader downloads an AKN file is not decided yet.

## Why

A law's place among other laws is data, not prose. When it lives in one file per law, anyone can
use it without the site (researchers, other apps), the site can be replaced without touching the
data, and a fix to a law is a fix to its data. legislation.gov.uk, Laws.Africa and Fedlex publish
this way.

## What we gave up

- Banners and notes on the site become fixed sentences filled from data. A case the templates do
  not fit gets no special wording.
- Derived links are recomputed on every export instead of read from the text.
