import * as v from "valibot";
import { describe, expect, it } from "vitest";

import {
  catalogFilePath,
  comparisonFilePath,
  staticPagePath,
} from "./schemas.ts";

const RELEASE = "c501581381b8c443";

describe("the published comparison file path", () => {
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

describe("the published law catalog path", () => {
  it("accepts the file of a release", () => {
    expect(
      v.is(catalogFilePath, `/data/${RELEASE}/law-catalog.json`)
    ).toBeTruthy();
  });

  it.each([
    `/data/${RELEASE}/law-catalog.json/`,
    `/data/${RELEASE}/../law-catalog.json`,
    `/data/UPPER/law-catalog.json`,
    `/data/${RELEASE}/laws/law-catalog.json`,
  ])("rejects %s", (path) => {
    expect(v.is(catalogFilePath, path)).toBeFalsy();
  });
});

describe("the path of a page built ahead of time", () => {
  it("accepts every page the build writes", () => {
    for (const path of [
      "/",
      "/tentang/",
      "/cari/",
      "/uu/",
      "/uu/tahun/2008/",
      "/uu/11/2008/",
      "/koleksi/",
      "/koleksi/bumn/",
      "/koleksi/bumn/2025-02-24/",
      "/ruu/",
      "/ruu/perampasan-aset/",
    ]) {
      expect(v.is(staticPagePath, path)).toBeTruthy();
    }
  });

  it("refuses what the Worker answers", () => {
    for (const path of [
      "/cari/hasil/",
      "/cari/laws.json",
      "/uu/11/2008",
      "/koleksi/bumn/perubahan.json",
      "/uu/tahun/abc/",
      "/data/c501581381b8c443/law-catalog.json",
    ]) {
      expect(v.is(staticPagePath, path)).toBeFalsy();
    }
  });
});
