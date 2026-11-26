import type { CompareRequest, PublishedComparison } from "../lib/compare.ts";
import {
  compareColumns,
  neighbourPairs,
  selectColumns,
} from "../lib/compare.ts";
import { readActiveRelease } from "./corpus.ts";
import {
  readCollectionVersions,
  readVersionPair,
} from "./records/collection-comparison.ts";

/**
 * The comparison of a collection's versions that `request` asks for, read from the published
 * pairs of neighbouring columns (each stored older version first); null when the collection
 * has no comparison. `request` comes from the address, so it is checked here.
 */
export const readComparison = async (slug: string, request: CompareRequest) => {
  const release = await readActiveRelease();
  const versions = await readCollectionVersions(slug);

  if (versions === null) {
    return null;
  }

  const ids = versions.map((version) => version.id);
  const selection = selectColumns(ids, request);

  const pairs = await Promise.all(
    neighbourPairs(ids, selection).map(async (pair) =>
      pair === null ? null : await readVersionPair(slug, ...pair)
    )
  );

  return {
    ...compareColumns(versions, selection, pairs),
    release,
  } satisfies PublishedComparison;
};
