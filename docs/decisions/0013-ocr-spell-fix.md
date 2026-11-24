# 0013 Misread words corrected only when a spell check is confident

Date: 2026-11-24 · Decided by: Frenico; measurement and change by Claude

## What

`pdf/ocr_fix.py` corrects words OCR misread on scanned pages (decision 0012's "rule table"
item), before structure parsing. An unknown word is corrected only when a spell check is
confident; everything else unknown stays as read and is counted (`ocr_unknown` in the version
record, `ocr_fixed` for the corrections, each correction listed in the parse warnings).

A word is corrected when all hold:

- letters only, not a Roman numeral, at least 4 long, not mixed case (numbers never change);
- in neither our word list (`pdf/ocr_rules/lexicon.txt`, words of ≥3 typed texts, built by
  `scripts/build_lexicon.py`; plus `lexicon-extra.txt` by hand) nor Hunspell's Indonesian or
  English dictionary;
- read at most twice in the law (a misread is a one-off; a term the dictionaries lack repeats);
- its best candidate, one letter edit or one letter-shape confusion away (`confusions.yaml`,
  "rn" for "m"), occurs at least twice in the same law and in ≥20 typed texts, and holds ≥90%
  of all candidates' scores.

Without Hunspell (`hunspell hunspell-id hunspell-en-us`, installed by the OCR workflows) nothing
is corrected. `PARSER_VERSION` 15.

Maintenance: a real word wrongly corrected → one line in `lexicon-extra.txt`; a recurring
misread the checker misses → a pair in `confusions.yaml`; both with a case in
`tests/test_ocr_fix.py`.

## Why: measured 2026-11-24

21 scanned UU (2014-2026) re-read with Indra, 151,554 words; every correction judged by eye in
its line.

| Version | Corrections | Right | Wrong |
|---|---|---|---|
| Plain spell check (any one edit, most frequent word, ≥90% confidence) | 31 distinct (7 laws) | ~8 | ~23: `Serbia`→`Serba`, `coal`→`soal`, `Perkada`→`Perkara`, place names `Gamping`, `Mlati`, `Talun` |
| + the law's own words (one-off unknown, candidate elsewhere in the law) | 16 distinct (8 laws) | ~9 | `kelab`→`kelas`, `rerata`→`merata`, `Rail`→`Riil`, `hostel`→`hotel` |
| + Hunspell `id_ID`/`en_US` as real words | 21 (21 laws) | 10 | `Hurufj`→`Huruf` (is "Huruf j": deletes content), `Provinsii` (a subscript i), district names `Sepatan`→`Selatan`, `Sota`→`Kota`, `Binuang`→`Bintang`, `haga`→`harga` (a species name) |
| **+ substitutions only; capitalised words only by a shape confusion (this decision)** | **10 (21 laws)** | **10** | **0** |

The 10: `dacrah`/`Dacrah`→`daerah`/`Daerah` (4), `divujudkan`→`diwujudkan`, `keuuhanan`→`ketuhanan`,
`anggarah`→`anggaran`, `keselamalan`→`keselamatan`, `wilayan`→`wilayah`, `lndonesia`→`Indonesia`.

It corrects little because Indra reads well: 1,028 unknown words (323 distinct) stay as read; in
a random 50 of those, about 3 were misreads or joined words (`pindana`, `danatau`,
`dikecualikandari`), the rest place names, new terms and acronyms. Regression set: 20/20
(before the last tightening; rerun in CI). `scripts/ocr_fix_report.py N` (run by
`parser-regression.yml`) prints every correction of a random sample with its line, to judge
again after a rule change.

## Given up / open

- Missing spaces (`Agarsetiaporang`, `danatau`, `hurufj` when the law has no `huruf` nearby)
  are counted as unknown, not split.
- A misread that is itself a real word ("dalam" read as "dalarn" is caught; "baku" read for
  "beku" is not) cannot be found without the page image; Tesseract as a second reader
  (decision 0012) is the way to mark those.
- Hunspell `id_ID` licence: MPL-2.0 / LGPL-3.0 (LibreOffice dictionaries); used from the
  system package at run time, not copied into the repository.
