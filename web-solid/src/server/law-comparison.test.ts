import { describe, expect, it } from "vitest";

import { compareVersions } from "./law-comparison.ts";
import type { CollectionComparison } from "./records/collection-comparison.ts";
import type { ReaderText } from "./records/reader-text.ts";

const version = (id: string, gap = 0) => ({
  id,
  label: id,
  cite: id.toUpperCase(),
  date: null,
  gap,
});

const data: CollectionComparison = {
  versions: [version("uu_1_2000"), version("uu_2_2010"), version("uu_3_2020")],
  pasal: [
    [
      "1",
      [
        [0, [["(1)", "Setiap orang wajib membayar pajak.", 0]]],
        [1, [["(1)", "Setiap orang wajib membayar pajak tepat waktu.", 0]]],
      ],
    ],
    [
      "2",
      [
        [0, null],
        [2, [[null, "Pasal baru.", 0]]],
      ],
    ],
    [
      "3",
      [
        [0, [[null, "Dihapus nanti.", 0]]],
        [2, "d"],
      ],
    ],
  ],
};

const article = (num: string) => ({
  tag: "article",
  num,
  eId: `art_${num}`,
  children: [],
});

const text: ReaderText = {
  preface: [],
  preamble: [],
  body: [
    {
      tag: "chapter",
      eId: "chp_1",
      num: "I",
      children: [article("1"), article("3")],
    },
  ],
  conclusions: [],
  penjelasan: [],
  anchors: {},
};

const marks = (changed: { num: string; mark: string }[]) =>
  changed.map(({ num, mark }) => `${num}:${mark}`);

describe(compareVersions, () => {
  it("compares the original with the latest version by default", () => {
    const result = compareVersions(data, text, "", undefined);

    expect([result.left, result.right]).toStrictEqual([0, 2]);
    expect(marks(result.changed)).toStrictEqual(["1:mod", "2:ins", "3:del"]);
  });

  it("compares a version with the one before it when only it is named", () => {
    const result = compareVersions(data, text, "uu_2_2010", undefined);

    expect([result.left, result.right]).toStrictEqual([0, 1]);
    expect(marks(result.changed)).toStrictEqual(["1:mod"]);
  });

  it("keeps the order of the columns the reader chose", () => {
    const result = compareVersions(data, text, "uu_1_2000", "uu_3_2020");

    expect([result.left, result.right]).toStrictEqual([2, 0]);
    expect([result.older, result.newer]).toStrictEqual([0, 2]);
    expect(marks(result.changed)).toStrictEqual(["1:mod", "2:ins", "3:del"]);
  });

  it("shows no change for the same version twice", () => {
    const result = compareVersions(data, text, "uu_2_2010", "uu_2_2010");

    expect(result.changed).toStrictEqual([]);
  });

  it("falls back to the default pair for an unknown id", () => {
    const result = compareVersions(data, text, "uu_0_0000", undefined);

    expect([result.left, result.right]).toStrictEqual([0, 2]);
  });

  it("places a pasal the text does not have after the pasal before it", () => {
    const result = compareVersions(data, text, "", undefined);

    expect(result.after).toStrictEqual({ art_1: ["2"] });
  });

  it("states what a version lacks and shows the new wording as inserted", () => {
    const result = compareVersions(data, text, "", undefined);
    const added = result.changed.find((entry) => entry.num === "2");

    expect(added?.note).toBe("UU_1_2000: pasal ini belum ada");
    expect(added?.lines[0].new).toStrictEqual([
      { kind: "ins", value: "Pasal baru." },
    ]);
  });
});
