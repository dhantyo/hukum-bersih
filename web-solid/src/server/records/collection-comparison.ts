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

export const readCollectionComparisonJson = async (slug: string) => {
  const text = await readActiveReleaseText(
    `collections/${slug}/perubahan.json`
  );

  if (text !== null) {
    parseRecord(comparison, text, `collection comparison ${slug}`);
  }

  return text;
};
