import type * as v from "valibot";

import type { compareSearch } from "./schemas.ts";

type CompareSearch = v.InferOutput<typeof compareSearch>;

/**
 * The pair a server function is asked for. A server function's arguments travel as JSON, which
 * cannot carry `undefined`, so a missing choice leaves its key out: `{ dari: undefined }` made
 * every client-side navigation into a collection page throw.
 */
export const comparisonRequest = ({ bandingkan, dari }: CompareSearch) => ({
  ...(bandingkan === undefined ? {} : { bandingkan }),
  ...(dari === undefined ? {} : { dari }),
});
