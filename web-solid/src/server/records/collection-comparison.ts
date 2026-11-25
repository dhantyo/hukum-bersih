import * as v from "valibot";

import { readActiveReleaseText } from "../corpus.ts";
import { diffLine } from "./diff-line.ts";
import { parseRecord } from "./parse.ts";

export const comparedVersion = v.object({
  id: v.string(),
  label: v.string(),
  cite: v.string(),
  date: v.nullable(v.string()),
  gap: v.number(),
});

const versionList = v.object({ versions: v.array(comparedVersion) });

const state = v.picklist(["text", "deleted", "unreadable", "absent"]);

const pasal = v.object({
  num: v.string(),
  before: state,
  after: state,
  lines: v.array(diffLine),
  numbered: v.optional(v.array(diffLine)),
});

const versionPair = v.object({ pasal: v.array(pasal) });

export type CollectionVersions = v.InferOutput<typeof versionList>["versions"];

export type VersionPair = v.InferOutput<typeof versionPair>;

export type PairPasal = VersionPair["pasal"][number];

export type PasalState = PairPasal["before"];

export const readCollectionVersions = async (slug: string) => {
  const text = await readActiveReleaseText(
    `collections/${slug}/comparisons/index.json`
  );

  return text === null
    ? null
    : parseRecord(versionList, text, `collection versions ${slug}`).versions;
};

/** The pasal that read differently in version `from` and in version `to`, diffed from the first
 * to the second. Both ids come from `readCollectionVersions`. */
export const readVersionPair = async (
  slug: string,
  from: string,
  to: string
) => {
  const text = await readActiveReleaseText(
    `collections/${slug}/comparisons/${from}...${to}.json`
  );

  if (text === null) {
    throw new Error(`Published comparison is missing: ${slug} ${from}...${to}`);
  }

  return parseRecord(
    versionPair,
    text,
    `version comparison ${slug} ${from}...${to}`
  );
};
