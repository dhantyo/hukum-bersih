import { describe, expect, it } from "vitest";

import { compareVersions, pickVersions } from "./law-comparison.ts";
import type {
  CollectionVersions,
  PairPasal,
  VersionPair,
} from "./records/collection-comparison.ts";
import type { DiffLine } from "./records/diff-line.ts";
import type { ReaderText } from "./records/reader-text.ts";

const version = (id: string, gap = 0) => ({
  id,
  label: id,
  cite: id.toUpperCase(),
  date: null,
  gap,
});

const versions: CollectionVersions = [
  version("uu_1_2000"),
  version("uu_2_2010"),
  version("uu_3_2020"),
];

const side = (num?: string) => ({ num, indent: 0 });

const part = (value: string, added = false, removed = false) => ({
  value,
  added,
  removed,
});

const reworded = {
  kind: "berubah",
  a: side("(1)"),
  b: side("(1)"),
  parts: [
    part("Setiap orang wajib membayar pajak"),
    part(" tepat waktu", true),
    part("."),
  ],
} satisfies DiffLine;

const inserted = {
  kind: "baru",
  b: side(),
  parts: [part("Pasal baru.", true)],
} satisfies DiffLine;

const removed = {
  kind: "dihapus",
  a: side(),
  parts: [part("Dihapus nanti.", false, true)],
} satisfies DiffLine;

const pasalOne = {
  num: "1",
  before: "text",
  after: "text",
  lines: [reworded],
} satisfies PairPasal;

const pasalTwo = {
  num: "2",
  before: "absent",
  after: "text",
  lines: [inserted],
} satisfies PairPasal;

const pasalThree = {
  num: "3",
  before: "text",
  after: "deleted",
  lines: [removed],
} satisfies PairPasal;

const pairs = {
  "0-1": { pasal: [pasalOne] },
  "0-2": { pasal: [pasalOne, pasalTwo, pasalThree] },
  "1-2": { pasal: [pasalTwo, pasalThree] },
} satisfies Record<string, VersionPair>;

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

const compare = (
  to: string,
  from?: string,
  record: Record<string, VersionPair> = pairs
) => {
  const picked = pickVersions(versions, to, from);

  return compareVersions(
    versions,
    picked,
    record[`${picked.older}-${picked.newer}`] ?? null,
    text
  );
};

const marks = (changed: { num: string; mark: string }[]) =>
  changed.map(({ num, mark }) => `${num}:${mark}`);

describe(compareVersions, () => {
  it("compares the original with the latest version by default", () => {
    const result = compare("");

    expect([result.left, result.right]).toStrictEqual([0, 2]);
    expect(marks(result.changed)).toStrictEqual(["1:mod", "2:ins", "3:del"]);
  });

  it("compares a version with the one before it when only it is named", () => {
    const result = compare("uu_2_2010");

    expect([result.left, result.right]).toStrictEqual([0, 1]);
    expect(marks(result.changed)).toStrictEqual(["1:mod"]);
  });

  it("keeps the order of the columns the reader chose", () => {
    const result = compare("uu_1_2000", "uu_3_2020");

    expect([result.left, result.right]).toStrictEqual([2, 0]);
    expect([result.older, result.newer]).toStrictEqual([0, 2]);
    expect(marks(result.changed)).toStrictEqual(["1:mod", "2:ins", "3:del"]);
  });

  it("shows no change for the same version twice", () => {
    expect(compare("uu_2_2010", "uu_2_2010").changed).toStrictEqual([]);
  });

  it("falls back to the default pair for an unknown id", () => {
    const result = compare("uu_0_0000");

    expect([result.left, result.right]).toStrictEqual([0, 2]);
  });

  it("places a pasal the text does not have after the pasal before it", () => {
    expect(compare("").after).toStrictEqual({ art_1: ["2"] });
  });

  it("states what a version lacks and shows the new wording as inserted", () => {
    const added = compare("").changed.find((entry) => entry.num === "2");

    expect(added?.note).toBe("UU_1_2000: pasal ini belum ada");
    expect(added?.lines[0].new).toStrictEqual([
      { kind: "ins", value: "Pasal baru." },
    ]);
  });

  it("shows a reworded ayat with the added words marked on both sides", () => {
    const [line] = compare("uu_2_2010").changed[0].lines;

    expect(line.inline.map(({ kind }) => kind)).toStrictEqual([
      "same",
      "ins",
      "same",
    ]);
    expect(line.old.map(({ kind }) => kind)).toStrictEqual(["same", "same"]);
  });

  it("reads the lines paired by number when the comparison has them", () => {
    const repealed = {
      kind: "diganti",
      a: side("(2)"),
      b: side("(2)"),
      parts: [part("Komisi dibentuk.", false, true), part("Dihapus.", true)],
    } satisfies DiffLine;

    const record = {
      ...pairs,
      "0-1": {
        pasal: [
          { ...pasalOne, lines: [removed, inserted], numbered: [repealed] },
        ],
      },
    };

    const [line] = compare("uu_2_2010", undefined, record).changed[0].lines;

    expect(line.kind).toBe("diganti");
    expect(line.new).toStrictEqual([{ kind: "gone", value: "Dihapus." }]);
    expect(line.old).toStrictEqual([
      { kind: "del", value: "Komisi dibentuk." },
    ]);
  });
});
