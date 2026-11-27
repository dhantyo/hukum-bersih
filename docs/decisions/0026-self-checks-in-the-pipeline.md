# 0026 Self-checks run in the pipeline and gate every new text

Date: 2026-11-28 · Decided by: the operator; change by Claude

## What

Every parse (import and reparse) ends with self-checks on its result.

- The checks build on `pipeline/scripts/check_texts.py` (valid AKN, pasal without gaps, no page
  furniture, closing date, Penjelasan against the body) and add word coverage (the share of the
  PDF's words in the output, measured while the PDF is at hand), the OCR unknown-word rate,
  ayat and list order, and checks for the Lampiran, tables and Penjelasan links.
- Each text version keeps its numbers and the checks it fails on the record. There is no single
  score; a report lists the laws with the most failed checks first, then the lowest word
  coverage.
- A new parse replaces a stored text only when it fails no check the stored text passes, on top
  of the current guard (`WORDS_KEPT`, pasal kept). Otherwise the old text stays and the record
  is flagged.
- A law whose text fails a check shows a quiet notice on the site with a link to the official
  PDF, one template for all laws.
- A parser PR reparses the regression set and a fixed stratified sample (about 100 laws by
  decade, PDF kind and law kind) on Actions and posts each check's count before and after. The
  whole corpus is reparsed on a schedule.

## Why

Most stored texts come from parser v12 while the parser is at v18 (measured 2026-11-27), and
only about 20 laws have checked counts. Without a measure on every law, a reparse cannot show
whether it helped, and errors nobody has seen stay unseen.

## What we gave up

- Records grow by a few fields per version, and quality numbers move in git diffs.
- A weighted score was not made: any weights would be invented.
