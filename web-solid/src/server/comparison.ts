import * as v from "valibot";

import type { CompareRequest } from "../lib/compare.ts";
import {
  compareColumns,
  pickColumns,
  unknownSelection,
} from "../lib/compare.ts";
import { compareRequest } from "../lib/schemas.ts";
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
  const versions = await readCollectionVersions(slug);

  if (versions === null) {
    return null;
  }

  const ids = versions.map((version) => version.id);
  const choice = v.safeParse(compareRequest, request);

  const selection = choice.success
    ? pickColumns(ids, choice.output)
    : unknownSelection;

  const pairs = await Promise.all(
    selection.columns.slice(1).map(async (to, index) => {
      const from = selection.columns[index];

      if (from === to) {
        return null;
      }

      return from < to
        ? await readVersionPair(slug, ids[from], ids[to])
        : await readVersionPair(slug, ids[to], ids[from]);
    })
  );

  return compareColumns(versions, selection, pairs);
};
