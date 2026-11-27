# 0028 MK rulings are parsed into data; the printed text stays

Date: 2026-11-28 · Decided by: the operator; change by Claude

## What

Each MK ruling BPK lists (`uji_materi[].amar`) is parsed into parts: kind (phrase, provision,
conditional, rewrite, whole law), targets (law, pasal, ayat, huruf, angka, Penjelasan or
Lampiran, and the omnibus pasal around it), the struck phrase, the conditional reading, MK's new
wording, and the ruling's date. A pipeline step writes them; nobody edits them by hand.

- A part is clean when its pattern matched and every target exists in our stored text, with a
  struck phrase found word for word. Only clean parts change what the site shows.
- A ruling the parser cannot read goes to the agent routine (decision 0022), which reads the amar
  in the MK ruling PDF and opens a PR. Until then the site shows the amar as a note with a link.
- The date comes from the ruling PDF. No date means none is shown; a ruling marks only text
  versions in force on or after its date.
- The printed text never changes. The site strikes a phrase, marks a provision as no longer
  binding, shows a conditional reading as a note, and shows MK's wording under a rewritten
  provision. In AKN: `forceMod type="unconstitutionality"` and `meaningMod type="variation"`
  (decision 0021).

## Why

BPK publishes 173 rulings on 124 laws (2026-11-27) as text a reader must apply in their head.
The court's ruling binds, so the reader should see where it applies, but BPK's text is retyped
by hand, and the MK PDF is the authority when they differ.

## What we gave up

- Rulings on KUHP pasal filed under `uu_1_1946`, and nested Cipta Kerja targets, wait for the
  Lampiran-as-law and omnibus work.
- A ruling without a readable date marks no version.
