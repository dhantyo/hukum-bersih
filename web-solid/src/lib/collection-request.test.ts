import { describe, expect, it } from "vitest";

import { comparisonRequest } from "./collection-request.ts";

describe(comparisonRequest, () => {
  it.each([
    [{ bandingkan: undefined, dari: undefined }, []],
    [{ bandingkan: "2024-01-02", dari: undefined }, ["bandingkan"]],
    [{ bandingkan: "2024-01-02", dari: "2020-03-04" }, ["bandingkan", "dari"]],
  ])(
    "keeps only the choices made, so a server function can take it: %j",
    (search, keys) => {
      expect(Object.keys(comparisonRequest(search))).toStrictEqual(keys);
    }
  );
});
