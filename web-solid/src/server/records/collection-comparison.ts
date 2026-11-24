import * as v from "valibot";

import { readActiveReleaseText } from "../corpus.ts";
import { parseRecord } from "./parse.ts";

const version = v.object({
  id: v.string(),
  label: v.string(),
  cite: v.string(),
  date: v.nullable(v.string()),
  gap: v.number(),
});

const line = v.tuple([v.nullable(v.string()), v.string(), v.number()]);

const slot = v.nullable(
  v.union([v.literal("d"), v.literal("u"), v.array(line)])
);

const comparison = v.object({
  versions: v.array(version),
  pasal: v.array(v.tuple([v.string(), v.array(v.tuple([v.number(), slot]))])),
});

export type CollectionComparison = v.InferOutput<typeof comparison>;

export type CompareSlot = v.InferOutput<typeof slot>;

const readComparisonText = async (slug: string) =>
  await readActiveReleaseText(`collections/${slug}/perubahan.json`);

const parseComparison = (text: string, slug: string) =>
  parseRecord(comparison, text, `collection comparison ${slug}`);

export const readCollectionComparisonJson = async (slug: string) => {
  const text = await readComparisonText(slug);

  if (text !== null) {
    parseComparison(text, slug);
  }

  return text;
};

export const readCollectionComparison = async (slug: string) => {
  const text = await readComparisonText(slug);

  return text === null ? null : parseComparison(text, slug);
};
