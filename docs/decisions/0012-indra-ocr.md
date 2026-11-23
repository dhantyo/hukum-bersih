# 0012 Indra OCR reads scanned pages

Date: 2026-11-23 · Decided by: Frenico; benchmark and change by Claude

## What

Scanned pages are read with [Indra OCR](https://github.com/datalab-to/indra) (`indra-ocr`, CPU,
ONNX Runtime, no GPU) instead of Tesseract `ind`. `pdf/extract.py`: `$HUKUM_BERSIH_OCR` =
`indra` (default) or `tesseract`; when Indra cannot load, Tesseract reads the pages and the
parse says so (`ocr fallback`). Indra's lines go through the same `rows()` as Tesseract's
words, so everything after the OCR is unchanged. Versions record `ocr_engine`. Install:
`uv sync --extra ocr` (the import and regression workflows do; Tesseract stays installed as the
fallback and as a second reader for later). `PARSER_VERSION` 14.

OCR'd texts read by another engine are no longer "current" (`text_current`): the next BPK import
re-reads the ~322 scanned UU with Indra, under the usual importer rules (a new text replaces the
old only with at least as many pasal and 85% of its words). Typed texts are not touched.

## Why: measured 2026-11-23

Ground truth: two pages of UU 11/2019 (a 2019 scan with damaged print), typed from the page
images. CER = wrong characters per 100, WER = wrong words per 100.

| Engine (CPU) | CER | WER | Speed |
|---|---|---|---|
| **our pipeline + Indra** | **0.29%** | **2.8%** | 83 pages in 16 s (4 cores) |
| our pipeline + Tesseract `tessdata_best` | 1.40% | 8.9% | |
| our pipeline + Tesseract (Ubuntu's `ind`, used until now) | 3.40% | 10.7% | 83 pages in 56 s |
| BPK's text layer (= markitdown without OCR) | 6.50% | 20.3% | |
| PaddleOCR PP-OCRv5 server det + latin rec | 0.58% | 4.0% | ~34 s/page, 6 GB RAM |
| MinerU2.5-Pro (1.2B VLM) | 0.95% | 3.4% | ~5 min/page, 7 GB RAM; dropped a line, added an accent |
| GLM-OCR (0.9B VLM) | 0.39% (1 page) | 3.5% | ~10 min/page |
| RapidOCR (PaddleOCR mobile) | 8.41% | 15.1% | lost whole lines |
| PaddleOCR-VL | no output after 22 min | | |

- UU 11/2019: the old pipeline found 35 of 100 pasal (OCR read "Pasai 38" and the parser lost
  the rest); with Indra all 100, and 98 Penjelasan entries.
- Regression set (tests/regression.yaml, 20 UU): 20/20 with both engines; 40 s with Indra,
  139 s with Tesseract.
- UU 20/1959 (one of the three old scans): where the engines differ, Indra was right 3 of 3
  (`*)`, `153);`, `Indonesia;`); its one slip: `a.Pasal` without the space.
- The worry from Indra's README ("old, faded scans read poorly") matters little here: in BPK's
  collection old laws are retyped; of 322 OCR'd UU, 315 are from the 2010s and 2020s.

LLM-based OCR (markitdown-ocr, which sends pages to a paid vision model) was not considered:
the aim is a free engine on a GitHub runner's CPU.

## Given up / open

- Licence: the code is Apache-2.0; the model weights use a modified OpenRAIL-M licence (free for
  research, personal use and organisations under US$20M; not to be used to compete with
  Datalab's API). A volunteer project publishing law texts does not compete with an OCR API, and
  the licence governs the model's use, not its output (our data stays CC0). For Dante to confirm.
- Two pages of ground truth are little. More pages, and old scans in the regression set, would
  make the comparison firmer.
- Next (agreed plan): a rule table for the OCR confusions all engines share (`daiam`, `hurut`,
  `berkelanjuran`; never numbers, never old spelling), and Tesseract as a second reader whose
  disagreements mark places for a person to check.
