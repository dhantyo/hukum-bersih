import { describe, expect, it } from "vitest";

import { comparisonRequest } from "./collection-request.ts";

describe(comparisonRequest, () => {
  it.each([
    [{ bandingkan: undefined, dari: undefined }],
    [{ bandingkan: "2024-01-02", dari: undefined }],
    [{ bandingkan: "2024-01-02", dari: "2020-03-04" }],
  ])("is JSON, so a server function can take it: %j", (search) => {
    const request = comparisonRequest(search);

    expect(JSON.parse(JSON.stringify(request))).toStrictEqual(request);
  });
});
