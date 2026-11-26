import * as v from "valibot";

import { comparedVersion } from "../../lib/pair-records.ts";
import { parseRecord } from "../../lib/parse-record.ts";
import { readActiveReleaseText } from "../corpus.ts";

const line = v.tuple([v.nullable(v.string()), v.string(), v.number()]);

const slot = v.nullable(
  v.union([v.literal("d"), v.literal("u"), v.array(line)])
);

const history = v.object({
  versions: v.array(comparedVersion),
  pasal: v.array(v.tuple([v.string(), v.array(v.tuple([v.number(), slot]))])),
});

const readHistoryText = async (slug: string) =>
  await readActiveReleaseText(`collections/${slug}/perubahan.json`);

const parseHistory = (text: string, slug: string) =>
  parseRecord(history, text, `collection history ${slug}`);

export const readCollectionHistoryJson = async (slug: string) => {
  const text = await readHistoryText(slug);

  if (text !== null) {
    parseHistory(text, slug);
  }

  return text;
};
