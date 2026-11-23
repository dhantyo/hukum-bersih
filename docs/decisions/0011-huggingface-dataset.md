# 0011 National regulations from the Hugging Face dataset ID_REG_RAG_2611

Date: 2026-11-23 · Decided by: Frenico; researched and built by Claude

## What

`hukum-bersih import-hf` (`pipeline/src/hukum_bersih/sources/id_reg_rag.py`, workflow
`import-huggingface.yml`) fills in national regulations we have no text of from the Hugging Face
dataset [`Azzindani/ID_REG_RAG_2611`](https://huggingface.co/datasets/Azzindani/ID_REG_RAG_2611)
(45,179 documents, built with the author's tool Ravel, revision 2 of 2026-11-15). First run,
2026-11-23: 6,277 new records (PP 2,387, Keppres 2,164, Perpres 1,350, UU Darurat 170, Perppu
149, Inpres 57), 4,605 of them with text. All types are published: the site is not public yet.

- Existing texts are never touched; a record without text gets one. (Of the 8 UU without text,
  none could be filled: the dataset's copies have no pasal either.)
- No new UU records: our UU list is BPK's complete one, and a UU the dataset adds is more likely
  mislabelled (`COMPLETE_TYPES`).
- National types only. Regional regulations (~28,000 in the dataset) need an id with the region
  (`perda_1_2010` is not unique; docs/NAMING.md has no rule yet) and, per the brief, maybe their
  own repository.

## How a text is made

The dataset is a retrieval corpus, not a set of documents: each regulation is cut into chunks and
the heading lines of the source Markdown are only in `heading_path` ("BAB I. › Pasal 1."). The
importer rebuilds the lines in order (each heading where the path first reaches it, several
headings in one segment split, preamble labels put where their text starts) and parses them
with our own parser, like PDF lines. Every such version says `source: dataset`,
`rebuilt_from_chunks: true`, with the dataset revision and document id; the record keeps the
dataset's own quality verdict and status under `id_reg`. Law pages say "Bukan salinan resmi".

A text is written only if the parse finds at least 90% of the pasal headings the dataset lists
(`KEEP`), else the record gets `parse_error` and no text. Inpres (instructions, KESATU …) and many
Keppres (decisions without pasal) get no text: the parser reads pasal only.

## Quality (measured 2026-11-23)

- The dataset's texts come 92% from the PDFs' own text layer (Ravel's EXTRACTION.md), the rest
  from SmolDocling or OCR. Typical text-layer misreads (`lndonesia`, `daiam`) occur in 1% of its UU.
- On UU 4/2009 against our text from the PDF: ~95% of the words shared; missing were the
  "Cukup jelas" entries of the Penjelasan and some hyphens ("perundangundangan").
- Rebuilt and parsed UU against our own UU texts: 84% the same pasal count, 94% within 5%.
- Errors that remain come from the dataset: a lost heading merges two pasal (PP 10/2000's
  Pasal 1 holds text of a later pasal); some texts are raw OCR (UU 7/2017); its type field is
  sometimes wrong (an Undang-Undang Darurat filed as UU, a Perppu as PP: both detected).

## Also changed

- `relations`: only a UU, UU Darurat or Perppu title can amend, revoke or enact a law. A PP's
  title names the law it implements ("PELAKSANAAN UNDANG-UNDANG NOMOR 8 TAHUN 1983 …
  SEBAGAIMANA TELAH … DIUBAH", PP 1/2012), which read as an amendment.
- Pages per type: `pages/[jenis]/` (was `pages/uu/`).

## Given up / open

- Fidelity: a rebuilt text is not a transcript of the official PDF (CLAUDE.md, text fidelity).
  It is labelled as such; replacing it with our own parse of the BPK PDF is the way back.
- Licence: the card says `license: other` ("not yet fixed; verify each text before
  redistributing it commercially"). Accepted: the texts are Indonesian law (UU 28/2014 Pasal 42).
- Size: the site now has 17,449 files; Cloudflare's free plan allows 20,000 per deployment.
  More types (regional, ministries) need another plan, R2 or a split site (decision 0002).
- Checked and not used: `Azzindani/ID_REG_MD_RAG` (702 UU, wrong labels: its "UU 4/2009" is about
  the KPK), `ID_REG_Markdown` (the per-law Markdown behind this dataset; not public).
