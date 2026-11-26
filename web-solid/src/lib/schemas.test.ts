import * as v from "valibot";
import { describe, expect, it } from "vitest";

import { comparisonFilePath } from "./schemas.ts";

const RELEASE = "c501581381b8c443";

describe(comparisonFilePath, () => {
  it.each([
    `/data/${RELEASE}/collections/ite/comparisons/index.json`,
    `/data/${RELEASE}/collections/ite/comparisons/uu_11_2008...uu_1_2024.json`,
  ])("accepts %s", (path) => {
    expect(v.is(comparisonFilePath, path)).toBeTruthy();
  });

  it.each([
    `/data/${RELEASE}/collections/ite/comparisons/../../active-release`,
    `/data/${RELEASE}/collections/ite/comparisons/..%2findex.json`,
    `/data/${RELEASE}/collections/../comparisons/index.json`,
    `/data/${RELEASE}/collections/ite/comparisons/a...b/c.json`,
    `/data/${RELEASE}/collections/ite/comparisons/a..b.json`,
    `/data/${RELEASE}/collections/ite/comparisons/index.json/`,
    `/data/.${RELEASE}/collections/ite/comparisons/index.json`,
    `/data/UPPER/collections/ite/comparisons/index.json`,
    `/data/${RELEASE}/collections/ITE/comparisons/index.json`,
  ])("rejects %s", (path) => {
    expect(v.is(comparisonFilePath, path)).toBeFalsy();
  });
});
