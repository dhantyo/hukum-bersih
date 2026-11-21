# Parser review against BPK PDFs (2026-11-21)

Sample: 2 random UU per decade (seed 20261121), BPK PDFs archived with
`import-bpk --only … --no-text`. Each PDF was rendered to page images and compared by eye with
the PDF's text layer and with the current parser's output (parser v4).

| Decade | Law | Pages | PDF kind | Pasal found (v4) |
|---|---|---|---|---|
| 1940s | UU 30/1947, UU 16/1947 | | not archived yet (archive.org rejected the PDFs) | |
| 1950s | UU 25/1956 | 77 | retyped (Word) | 1 |
| 1950s | UU 2/1957 | 36 | retyped | 3 |
| 1960s | UU 6/1964 | 12 | retyped (Word) | 0 |
| 1960s | UU 12/1964 | 9 | retyped (Word) | 0 |
| 1970s | UU 4/1971 | 6 | retyped | 0 |
| 1970s | UU 12/1971 | | not archived yet (archive.org timeout) | |
| 1980s | UU 10/1980 | 8 | retyped | 9 |
| 1980s | UU 1/1981 | 7 | retyped | 8 |
| 1990s | UU 19/1997 | 59 | retyped | 22 |
| 1990s | UU 31/1999 | | not archived yet (archive.org rejected the PDF) | |
| 2000s | UU 29/2007 | 37 | typeset | 40 |
| 2000s | UU 19/2001 | 26 | retyped | 17 |
| 2010s | UU 14/2013 | 16 | Word | 2 (amending law: Pasal I, II) |
| 2010s | UU 3/2019 | 7 | **scan + OCR layer** | 2 |
| 2020s | UU 18/2025 | 54 | **scan + OCR layer** | 4 (amending law) |
| 2020s | UU 1/2022 | | archived, download not yet possible (archive.org 403, item processing) | |
| (extra) | UU 5/2026 | 26 | **scan + OCR layer** | 2 (amending law) |

BPK's PDFs of older laws are retyped documents with a clean text layer; recent laws are scans of
the signed copy with an OCR layer made by someone else, of poor quality ("2OO2", "REPUBUK",
"SK No2933E2A" for "SK No 293382 A"). Tesseract 5 (`ind`, 300 dpi) read the same UU 5/2026 page
correctly.

## Kinds of error

| | Error | Where | Example |
|---|---|---|---|
| A | Headings with a full stop are not recognised | 1950s-1970s | `Pasal 1.`, `BAB I.`, `BAGIAN II.` (0 or 1 pasal found) |
| B | Old division names: Roman or spelled-out numbers | 1950s | `Bagian I.`, `Bab Pertama` |
| C | Page-turn words (catchwords) left in the text | all | `Pasal 2…`, `MEMUTUSKAN:…`, `d. bahwa . . .` (75 in UU 25/1956) |
| D | Page numbers split over three lines stay in the text | retyped | `-` / `3` / `-` |
| E | A list starting on the label's line is not split into items | all | `Menimbang : a. bahwa …`, `Mengingat : 1. …` |
| F | The sentence after Mengingat is glued to the last item | all | `… 1964. Dengan persetujuan Dewan Perwakilan Rakyat …` |
| G | Running header and `SK No` serial in OCR'd scans | scans | OCR variants the header rules miss |
| H | OCR noise in numbers and words | scans | `Pasal 1lA` (11A), `2OO2`, `l4l` |
| I | `Pasal` alone on a line, number below | scans | UU 18/2025 |
| J | Amending laws (Pasal I with numbered changes and quoted new pasal) | 2000s+ | known gap |
| K | Inserted chapters in amending laws | 2020s | `BAB IVA` |

## Plan

1. Rules for A-F in `pdf/extract.py` and `pdf/structure.py`, each with a test from these pages.
2. For scans (detected by full-page images): our own OCR (Tesseract `ind`) instead of the
   embedded layer, then the same rules; G-I mostly disappear with better OCR.
3. J (amending laws) by porting Pasal.id's approach (decision 0005).
4. Re-run the sample after each step and compare pasal counts and the page images again.

## Progress

Regression set: `pipeline/tests/regression.yaml` (the sample plus UU 4/2009, counts read from the
PDFs), run with `uv run python scripts/regress.py` in `pipeline/`.

| Parser | Expected counts | Leaks (page-turn words, page numbers, titles) |
|---|---|---|
| v4 | 9/15 | in 13 of 15 (UU 4/2009: 56 page-turn words; UU 2/1957, 19/1997: 33-34 page numbers) |
| v5 (2026-11-21) | 14/15 | page-turn word left in 2 laws; "SK No" serial in 2 scans |

v5: printed lines rebuilt from word positions (BPK stores justified text one word per line);
page-turn words at the foot of a page and split page numbers dropped (C, D); headings with a
full stop, BAGIAN/Bab Pertama numbering, BAB printed twice, "Pasal" and number on separate
lines (A, B, I); multi-line chapter titles in normal capitals; lists on the label's line and
after a lone ":" (E); "Dengan persetujuan …" as its own part (F); crest caption kept out of the
title (G, partly); "PENJELASAN UMUM" on one line; old closing formula ("Agar supaya …"); the
closing kept line by line as printed. Tests: `pipeline/tests/test_parser_v5.py`.

Still open: amending laws (J, UU 18/2025 counts 4 instead of Pasal I/II); OCR for scans (H;
"SK No" serials, G); Lampiran (L); closing as structured fields for the Modern view; stored
texts are not re-parsed yet.
