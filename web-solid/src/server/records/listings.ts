import * as v from "valibot";

import { parseRecord } from "../../lib/parse-record.ts";
import { draftDocumentId, lawPath, slug } from "../../lib/schemas.ts";
import { readActiveReleaseText } from "../corpus.ts";

const lawRow = v.object({
  u: lawPath,
  title: v.string(),
  short: v.nullable(v.string()),
  cite: v.string(),
  status: v.nullable(v.object({ key: v.string(), label: v.string() })),
  date: v.nullable(v.string()),
  changed: v.number(),
  amends: v.array(v.string()),
  hasText: v.boolean(),
});

const overview = v.object({
  total: v.number(),
  withText: v.number(),
  sources: v.array(
    v.object({
      host: v.pipe(v.string(), v.regex(/^[a-z0-9.-]+$/u)),
      name: v.string(),
    })
  ),
  decades: v.array(
    v.object({
      decade: v.number(),
      years: v.array(v.object({ year: v.number(), count: v.number() })),
    })
  ),
  recent: v.array(lawRow),
});

const yearListing = v.object({ year: v.number(), rows: v.array(lawRow) });

const draftListing = v.object({
  slug,
  name: v.string(),
  title: v.string(),
  versions: v.number(),
  last: v.nullable(
    v.object({
      stage: v.string(),
      note: v.nullable(v.string()),
      date: v.string(),
    })
  ),
  changes: v.nullable(v.object({ from: draftDocumentId, to: draftDocumentId })),
});

export type LawRow = v.InferOutput<typeof lawRow>;

export type LawOverview = v.InferOutput<typeof overview>;

export type DraftListing = v.InferOutput<typeof draftListing>;

export const readLawOverview = async () => {
  const text = await readActiveReleaseText("listings/overview.json");

  if (text === null) {
    throw new Error("The active release has no law overview");
  }

  return parseRecord(overview, text, "law overview");
};

export const readYearListing = async (year: string) => {
  const text = await readActiveReleaseText(`listings/years/${year}.json`);

  return text === null ? null : parseRecord(yearListing, text, `year ${year}`);
};

export const readDraftListings = async () => {
  const text = await readActiveReleaseText("listings/drafts.json");

  if (text === null) {
    throw new Error("The active release has no draft listing");
  }

  return parseRecord(v.array(draftListing), text, "draft listing");
};
