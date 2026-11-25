import * as v from "valibot";

import { readActiveReleaseText } from "../corpus.ts";
import { diffLine } from "./diff-line.ts";
import { draftDocument } from "./draft.ts";
import { parseRecord } from "./parse.ts";

const anchor = v.pipe(v.string(), v.regex(/^[ab]-[\w.:-]+$/u));
const status = v.picklist(["sama", "berubah", "baru", "dihapus"]);

const line = v.object({
  ...diffLine.entries,
  ref: v.optional(
    v.object({
      label: v.string(),
      side: v.picklist(["a", "b"]),
      anchor,
    })
  ),
});

const pasal = v.object({ label: v.string() });

const row = v.object({
  anchor,
  status,
  renumbered: v.boolean(),
  moved: v.boolean(),
  weak: v.boolean(),
  chapter: v.optional(v.string()),
  a: v.optional(pasal),
  b: v.optional(pasal),
  lines: v.array(line),
});

const comparison = v.object({
  name: v.string(),
  title: v.string(),
  older: draftDocument,
  newer: draftDocument,
  counts: v.object({
    sama: v.number(),
    berubah: v.number(),
    baru: v.number(),
    dihapus: v.number(),
    renumbered: v.number(),
    moved: v.number(),
  }),
  rows: v.array(row),
});

export type DraftComparison = v.InferOutput<typeof comparison>;

export type DraftComparisonRow = DraftComparison["rows"][number];

export type DraftComparisonLine = DraftComparisonRow["lines"][number];

export const readDraftComparison = async (billSlug: string, pair: string) => {
  const text = await readActiveReleaseText(
    `drafts/${billSlug}/comparisons/${pair}.json`
  );

  if (text === null) {
    return null;
  }

  const record = parseRecord(
    comparison,
    text,
    `draft comparison ${billSlug}/${pair}`
  );

  if (`${record.older.id}...${record.newer.id}` !== pair) {
    throw new Error(`Published comparison does not match ${billSlug}/${pair}`);
  }

  return record;
};
