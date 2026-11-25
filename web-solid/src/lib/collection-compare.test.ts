import { describe, expect, it } from "vitest";

import type {
  CollectionVersions,
  PairPasal,
  VersionPair,
} from "../server/records/collection-comparison.ts";
import type { DiffLine } from "../server/records/diff-line.ts";
import { compareColumns, pickColumns } from "./collection-compare.ts";
import type { CompareRequest } from "./collection-compare.ts";

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

const reworded = {
  kind: "berubah",
  a: { num: "(1)", indent: 0 },
  b: { num: "(1)", indent: 0 },
  parts: [part("Pajak"), part(" tepat waktu", true), part(" dibayar.")],
} satisfies DiffLine;

const replaced = {
  kind: "berubah",
  a: { num: "(1)", indent: 0 },
  b: { num: "(1)", indent: 0 },
  parts: [part("Pajak"), part(" tepat waktu", false, true), part(" dibayar.")],
} satisfies DiffLine;

const inserted = {
  kind: "baru",
  b: { indent: 0 },
  parts: [part("Pasal baru.", true)],
} satisfies DiffLine;

const removed = {
  kind: "dihapus",
  a: { indent: 0 },
  parts: [part("Dihapus nanti.", false, true)],
} satisfies DiffLine;

const pasal = (
  num: string,
  before: PairPasal["before"],
  after: PairPasal["after"],
  lines: DiffLine[]
) => ({ num, before, after, lines }) satisfies PairPasal;

const text = (cell: { lines: { parts: { value: string }[] }[] }) =>
  cell.lines.map((line) => line.parts.map((entry) => entry.value).join(""));

const compare = (request: CompareRequest, links: (VersionPair | null)[]) =>
  compareColumns(versions, pickColumns(ids, request), links);

const threeColumns = () =>
  compare({ v: "a,b,c" }, [
    { pasal: [pasal("1", "text", "text", [reworded])] },
    { pasal: [pasal("3", "text", "deleted", [removed])] },
  ]);

const twoColumns = () =>
  compare({ v: "a,c" }, [
    {
      pasal: [
        pasal("1", "text", "text", [reworded]),
        pasal("2", "absent", "text", [inserted]),
      ],
    },
  ]);

describe(pickColumns, () => {
  it("compares nothing until a version is asked for", () => {
    expect(pickColumns(ids, {})).toStrictEqual({ unknown: false, columns: [] });
  });

  it("reads any number of columns from a comma list or a repeated field", () => {
    expect(pickColumns(ids, { v: "c,a,d" }).columns).toStrictEqual([2, 0, 3]);
    expect(pickColumns(ids, { v: ["b", "d"] }).columns).toStrictEqual([1, 3]);
  });

  it("flags a version the collection does not have, and a list of fewer than two", () => {
    expect(pickColumns(ids, { v: "a,zzz" })).toStrictEqual({
      unknown: true,
      columns: [],
    });

    expect(pickColumns(ids, { v: "a" }).unknown).toBeTruthy();
  });

  it("still reads the pair of the older search", () => {
    expect(
      pickColumns(ids, { bandingkan: "d", dari: "a" }).columns
    ).toStrictEqual([0, 3]);

    expect(pickColumns(ids, { bandingkan: "c" }).columns).toStrictEqual([1, 2]);
    expect(pickColumns(ids, { bandingkan: "" }).columns).toStrictEqual([2, 3]);
    expect(pickColumns(ids, { dari: "b" }).columns).toStrictEqual([1, 3]);
    expect(pickColumns(ids, { bandingkan: "zzz" }).unknown).toBeTruthy();
  });
});

describe(compareColumns, () => {
  it("shows two columns as the pasal that differ, in the order asked for", () => {
    const view = twoColumns();

    expect(view.chosen).toStrictEqual(["a", "c"]);
    expect(view.rows.map((row) => row.num)).toStrictEqual(["1", "2"]);
    expect(view.rows[1].cells.map((cell) => cell.state)).toStrictEqual([
      "absent",
      "text",
    ]);
  });

  it("marks what changed in the second column only", () => {
    const [first, second] = twoColumns().rows[0].cells;

    expect(text(first)).toStrictEqual(["Pajak dibayar."]);
    expect(text(second)).toStrictEqual(["Pajak tepat waktu dibayar."]);
    expect(second.lines[0].parts.some((entry) => entry.added)).toBeTruthy();
    expect(first.lines[0].parts.some((entry) => entry.added)).toBeFalsy();
  });

  it("fills the column a pasal did not change in from its neighbour, unmarked", () => {
    const one = threeColumns().rows.find((row) => row.num === "1");

    expect(one?.cells.map(text)).toStrictEqual([
      ["Pajak dibayar."],
      ["Pajak tepat waktu dibayar."],
      ["Pajak tepat waktu dibayar."],
    ]);

    expect(one?.cells[2].lines[0].parts).toStrictEqual([
      { value: "Pajak tepat waktu dibayar.", added: false, removed: false },
    ]);
  });

  it("keeps the text of a pasal in the columns before it was deleted", () => {
    const three = threeColumns().rows.find((row) => row.num === "3");

    expect(three?.cells.map((cell) => cell.state)).toStrictEqual([
      "text",
      "text",
      "deleted",
    ]);

    expect(text(three?.cells[0] ?? { lines: [] })).toStrictEqual([
      "Dihapus nanti.",
    ]);
  });

  it("takes an early column's text from the link on its right, and a late one from the left", () => {
    const view = compare({ v: "a,b,c,d" }, [
      { pasal: [] },
      { pasal: [pasal("1", "text", "text", [replaced])] },
      { pasal: [] },
    ]);

    expect(view.rows[0].cells.map(text)).toStrictEqual([
      ["Pajak tepat waktu dibayar."],
      ["Pajak tepat waktu dibayar."],
      ["Pajak tepat waktu dibayar."],
      ["Pajak dibayar."],
    ]);

    expect(
      view.rows[0].cells.map((cell) =>
        cell.lines[0].parts.some((entry) => entry.removed)
      )
    ).toStrictEqual([false, false, true, false]);
  });

  it("lists the pasal in number order whichever link names them first", () => {
    const view = compare({ v: "a,b,c" }, [
      { pasal: [pasal("10", "absent", "text", [inserted])] },
      {
        pasal: [
          pasal("9", "absent", "text", [inserted]),
          pasal("10A", "absent", "text", [inserted]),
          pasal("2", "absent", "text", [inserted]),
        ],
      },
    ]);

    expect(view.rows.map((row) => row.num)).toStrictEqual([
      "2",
      "9",
      "10",
      "10A",
    ]);
  });

  it("treats the same version twice in a row as no change between the columns", () => {
    const view = compare({ v: "a,a,b" }, [
      null,
      { pasal: [pasal("1", "text", "text", [reworded])] },
    ]);

    expect(view.rows[0].cells.map(text)).toStrictEqual([
      ["Pajak dibayar."],
      ["Pajak dibayar."],
      ["Pajak tepat waktu dibayar."],
    ]);
  });

  it("reports the amendments missing between the first and last version shown", () => {
    expect(compare({ v: "a,d" }, [{ pasal: [] }]).gap).toBe(1);
    expect(compare({ v: "c,d" }, [{ pasal: [] }]).gap).toBe(0);
    expect(compare({ v: "d,a" }, [{ pasal: [] }]).gap).toBe(1);
  });

  it("has no rows when nothing was asked for", () => {
    const view = compare({}, []);

    expect(view.chosen).toStrictEqual([]);
    expect(view.rows).toStrictEqual([]);
    expect(view.versions.map((entry) => entry.id)).toStrictEqual(ids);
  });
});
