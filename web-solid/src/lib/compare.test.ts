import { describe, expect, it } from "vitest";

import type { ReaderText } from "../server/records/reader-text.ts";
import {
  compareColumns,
  pickColumns,
  placeInText,
  unknownSelection,
} from "./compare.ts";
import type { Piece } from "./compare.ts";
import type { DiffLine } from "./diff-line.ts";
import type {
  CollectionVersions,
  PairPasal,
  VersionPair,
} from "./pair-records.ts";

const version = (id: string, gap = 0) => ({
  id,
  label: id,
  cite: id.toUpperCase(),
  date: null,
  gap,
});

const versions: CollectionVersions = [
  version("a"),
  version("b", 1),
  version("c"),
  version("d"),
];

const ids = versions.map((entry) => entry.id);

const part = (value: string, added = false, removed = false) => ({
  value,
  added,
  removed,
});

const side = (num?: string) => ({ num, indent: 0 });

const reworded = {
  kind: "berubah",
  a: side("(1)"),
  b: side("(1)"),
  parts: [part("Pajak"), part(" tepat waktu", true), part(" dibayar.")],
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

const sameLine = (num: string, text: string) =>
  ({
    kind: "sama",
    a: side(num),
    b: side(num),
    parts: [part(text)],
  }) satisfies DiffLine;

const changed = (
  num: string,
  lines: DiffLine[],
  extra: Partial<PairPasal> = {}
) =>
  ({
    num,
    before: "text",
    after: "text",
    lines,
    ...extra,
  }) satisfies PairPasal;

const pasalOne = changed("1", [reworded]);

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

const kinds = (pieces: Piece[]) => pieces.map((piece) => piece.kind);

const columns = (picked: number[]) => ({
  requested: true,
  unknown: false,
  columns: picked,
});

describe(pickColumns, () => {
  it("shows nothing when the address does not ask for a comparison", () => {
    expect(pickColumns(ids, {})).toStrictEqual({
      requested: false,
      unknown: false,
      columns: [],
    });
  });

  it("takes the versions of a comma list or a repeated field, in order", () => {
    expect(pickColumns(ids, { v: "d,a,c" }).columns).toStrictEqual([3, 0, 2]);
    expect(pickColumns(ids, { v: ["b", "c"] }).columns).toStrictEqual([1, 2]);
  });

  it("sets one version against the one before it, the first against the next", () => {
    expect(pickColumns(ids, { v: "c" }).columns).toStrictEqual([1, 2]);
    expect(pickColumns(ids, { v: "a" }).columns).toStrictEqual([0, 1]);
  });

  it("sets the first version against the latest when nothing is named", () => {
    expect(pickColumns(ids, { v: "" }).columns).toStrictEqual([0, 3]);
    expect(pickColumns(["a"], { v: "" })).toStrictEqual(unknownSelection);
  });

  it("refuses a version the collection does not have", () => {
    expect(pickColumns(ids, { v: "a,zzz" })).toStrictEqual(unknownSelection);
    expect(pickColumns(ids, { v: "zzz" })).toStrictEqual(unknownSelection);
  });
});

describe(compareColumns, () => {
  it("lists the pasal that differ between two columns in number order, paired line by line", () => {
    const pair: VersionPair = { pasal: [pasalThree, pasalOne, pasalTwo] };
    const view = compareColumns(versions, columns([0, 1]), [pair]);

    expect(view.chosen).toStrictEqual(["a", "b"]);
    expect(view.rows.map((row) => row.num)).toStrictEqual(["1", "2", "3"]);
    expect(view.gap).toBe(1);
  });

  it("shows each side of a reworded ayat, and both merged for a narrow place", () => {
    const view = compareColumns(versions, columns([0, 1]), [
      { pasal: [pasalOne] },
    ]);

    const [one] = view.rows;

    expect(kinds(one.cells[0].lines[0].pieces)).toStrictEqual(["same", "same"]);
    expect(kinds(one.cells[1].lines[0].pieces)).toStrictEqual([
      "same",
      "ins",
      "same",
    ]);
    expect(one.merged?.[0].num).toBe("(1)");
  });

  it("pairs lines by number where the pair carries them so", () => {
    const byPosition = changed("4", [
      {
        kind: "diganti",
        a: side("(1)"),
        b: side("(2)"),
        parts: [part("lama", false, true), part("baru", true)],
      },
    ]);

    const byNumber = changed("4", byPosition.lines, {
      numbered: [sameLine("(1)", "satu"), sameLine("(2)", "dua")],
    });

    const view = compareColumns(versions, columns([0, 1]), [
      { pasal: [byNumber] },
    ]);

    expect(view.rows[0].cells.map((cell) => cell.lines.length)).toStrictEqual([
      2, 2,
    ]);
    expect(view.rows[0].cells[0].lines.map((line) => line.num)).toStrictEqual([
      "(1)",
      "(2)",
    ]);
  });

  it("marks colours by age and puts the newer version on the left when asked to", () => {
    const pair: VersionPair = { pasal: [pasalOne] };
    const [row] = compareColumns(versions, columns([1, 0]), [pair]).rows;

    expect(kinds(row.cells[0].lines[0].pieces)).toContain("ins");
    expect(kinds(row.cells[1].lines[0].pieces)).not.toContain("ins");
  });

  it("marks a pasal inserted, repealed or reworded, and says where a column lacks it", () => {
    const pair: VersionPair = { pasal: [pasalOne, pasalTwo, pasalThree] };
    const view = compareColumns(versions, columns([0, 1]), [pair]);

    expect(view.rows.map((row) => row.mark)).toStrictEqual([
      "mod",
      "ins",
      "del",
    ]);
    expect(view.rows[1].note).toBe("A: pasal ini belum ada");
    expect(view.rows[2].note).toBe("B: pasal ini dihapus");
  });

  it("builds a column for each version and keeps the text of a column that did not change", () => {
    const pairs: VersionPair[] = [{ pasal: [pasalOne] }, { pasal: [pasalTwo] }];

    const view = compareColumns(versions, columns([0, 1, 2]), pairs);
    const [one, two] = view.rows;

    expect(one.cells.map((cell) => cell.state)).toStrictEqual([
      "text",
      "text",
      "text",
    ]);
    expect(one.cells[2].lines[0].pieces).toStrictEqual([
      { kind: "same", value: "Pajak tepat waktu dibayar." },
    ]);
    expect(two.cells.map((cell) => cell.state)).toStrictEqual([
      "absent",
      "absent",
      "text",
    ]);
    expect(view.gap).toBe(1);
  });

  it("shows no pasal when both columns are the same version", () => {
    const view = compareColumns(versions, columns([2, 2]), [null]);

    expect(view.rows).toStrictEqual([]);
    expect(view.chosen).toStrictEqual(["c", "c"]);
  });
});

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

describe(placeInText, () => {
  it("keeps the pasal the text has and places a missing one after the pasal before it", () => {
    const pair: VersionPair = {
      pasal: [pasalOne, pasalTwo, changed("3A", [reworded]), changed("0", [])],
    };

    const view = compareColumns(versions, columns([0, 1]), [pair]);
    const placed = placeInText(view, text);

    expect(placed.after).toStrictEqual({ art_1: ["2"], art_3: ["3A"] });
    expect(placed.rows.map((row) => row.num)).toStrictEqual(["1", "2", "3A"]);
  });
});
