import type * as v from "valibot";

import type { compareSearch } from "./schemas.ts";

type CompareSearch = v.InferOutput<typeof compareSearch>;

/**
 * The pair a server function is asked for. Its arguments travel as JSON, which cannot carry
 * `undefined`, so a choice not made is left out: `{ dari: undefined }` made every client-side
 * navigation into a collection page throw.
 */
export const comparisonRequest = ({ bandingkan, dari }: CompareSearch) => {
  const request: Partial<CompareSearch> = {};

  if (bandingkan !== undefined) {
    request.bandingkan = bandingkan;
  }

  if (dari !== undefined) {
    request.dari = dari;
  }

  return request;
};
