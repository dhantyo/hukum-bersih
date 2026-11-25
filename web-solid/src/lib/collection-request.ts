import type * as v from "valibot";

import type { CompareRequest } from "./collection-compare.ts";
import type { compareSearch } from "./schemas.ts";

type CompareSearch = v.InferOutput<typeof compareSearch>;

/**
 * The pair a server function is asked for. Its arguments travel as JSON, which cannot carry
 * `undefined`, so a choice not made is left out: `{ dari: undefined }` made every client-side
 * navigation into a collection page throw.
 */
export const comparisonRequest = ({ v, bandingkan, dari }: CompareSearch) => {
  const request: CompareRequest = {};

  if (v !== undefined) {
    request.v = v;
  }

  if (bandingkan !== undefined) {
    request.bandingkan = bandingkan;
  }

  if (dari !== undefined) {
    request.dari = dari;
  }

  return request;
};
