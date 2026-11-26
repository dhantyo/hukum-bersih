import { versionList, versionPair } from "../../lib/pair-records.ts";
import { parseRecord } from "../../lib/parse-record.ts";
import { readActiveReleaseText } from "../corpus.ts";

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
