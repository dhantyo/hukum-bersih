import { createMemo } from "solid-js";
import type * as v from "valibot";

import { comparisonRequest } from "./collection-request.ts";
import { collectionComparisonQuery, collectionQuery } from "./queries.ts";
import type { compareSearch } from "./schemas.ts";

type CompareSearch = v.InferOutput<typeof compareSearch>;

export const preloadCollection = (
  slug: string,
  version: string,
  search: CompareSearch
) => {
  void collectionQuery(slug, version);
  void collectionComparisonQuery(slug, comparisonRequest(search));
};

/** What a collection page reads: the record, and the version comparison its search asks for. */
export const useCollection = (
  slug: () => string,
  version: () => string,
  search: () => CompareSearch
) => {
  const collection = createMemo(
    async () => await collectionQuery(slug(), version())
  );

  const comparison = createMemo(
    async () =>
      await collectionComparisonQuery(slug(), comparisonRequest(search()))
  );

  return { collection, comparison };
};
