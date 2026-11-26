import { createMemo } from "solid-js";
import type * as v from "valibot";

import type { LawRecord } from "../server/records/law.ts";
import { noteShown } from "./browser-comparison.ts";
import { comparisonRequest, placeInText } from "./compare.ts";
import { collectionComparisonQuery, lawQuery } from "./queries.ts";
import type { compareSearch } from "./schemas.ts";

type CompareSearch = v.InferOutput<typeof compareSearch>;

const ignore = () => {};

const comparisonAsked = (law: LawRecord, search: CompareSearch) =>
  search.v !== undefined && law.family?.comparable === true && law.text !== null
    ? { slug: law.family.slug, request: comparisonRequest(search) }
    : undefined;

const preloadComparison = async (path: string, search: CompareSearch) => {
  const law = await lawQuery(path);
  const asked = law === null ? undefined : comparisonAsked(law, search);

  if (asked !== undefined) {
    await collectionComparisonQuery(asked.slug, asked.request);
  }
};

export const preloadLaw = (path: string, search: CompareSearch) => {
  void preloadComparison(path, search).catch(ignore);
};

/** The comparison of the law's collection that the address asks for, placed in the law's own
 * text; undefined when it asks for none. */
export const useLawComparison = (law: LawRecord, search: () => CompareSearch) =>
  createMemo(async () => {
    const asked = comparisonAsked(law, search());

    const comparison =
      asked === undefined
        ? null
        : noteShown(
            asked.slug,
            await collectionComparisonQuery(asked.slug, asked.request)
          );

    return comparison === null || law.text === null
      ? undefined
      : placeInText(comparison, law.text);
  });
