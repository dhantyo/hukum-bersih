import { describe, expect, it } from "vitest";

import type { AknNode, ReaderText } from "../server/records/reader-text.ts";
import { runName, spanEntries, textSource } from "./compare-span.ts";
import { compareColumns } from "./compare.ts";
import type { CompareRow } from "./compare.ts";

const article = (num: string) =>
  ({
    tag: "article",
    eId: `pasal-${num.toLowerCase()}`,
    num,
    children: [{ tag: "p", text: `Isi Pasal ${num}.`, children: [] }],
  }) satisfies AknNode;

const textOf = (...nums: string[]) =>
  ({
    preface: [],
    preamble: [],
    body: [
      {
        tag: "chapter",
        num: "I",
        children: nums.map(article),
      },
    ],
    conclusions: [],
    penjelasan: [],
    anchors: {},
  }) satisfies ReaderText;

const row = (num: string, mark: CompareRow["mark"] = "mod") =>
  ({
    num,
    key: num.toLowerCase(),
    mark,
    note: "",
    cells: [],
  }) satisfies CompareRow;

const order = (entries: ReturnType<typeof spanEntries>) =>
  entries.map((entry) =>
    entry.kind === "changed"
      ? `~${entry.row.num}`
      : `=${entry.pasal.map((one) => one.num).join(",")}`
  );

describe(spanEntries, () => {
  it("lists unchanged pasal between changed ones, joined into runs", () => {
    const entries = spanEntries(
      [row("74"), row("75"), row("75A", "ins")],
      textOf("73", "74", "75", "75A", "76", "77", "78"),
      ""
    );

    expect(order(entries)).toStrictEqual([
      "=73",
      "~74",
      "~75",
      "~75A",
      "=76,77,78",
    ]);
  });

  it("puts a pasal the text lacks (added) among the rest by number", () => {
    const entries = spanEntries([row("5A", "ins")], textOf("5", "6"), "");

    expect(order(entries)).toStrictEqual(["=5", "~5A", "=6"]);
  });

  it("keeps a deleted pasal as a changed row in its place", () => {
    const entries = spanEntries([row("6", "del")], textOf("5", "7"), "");

    expect(order(entries)).toStrictEqual(["=5", "~6", "=7"]);
  });

  it("orders 5, 5A, 5B, 6 and 17 as readers expect", () => {
    const entries = spanEntries(
      [row("17"), row("5B", "ins")],
      textOf("6", "5", "5A", "17A"),
      ""
    );

    expect(order(entries)).toStrictEqual(["=5,5A", "~5B", "=6", "~17", "=17A"]);
  });

  it("treats a number named by a row as changed even when the text has it", () => {
    const entries = spanEntries([row("5")], textOf("5"), "");

    expect(order(entries)).toStrictEqual(["~5"]);
  });

  it("narrows both kinds to one number", () => {
    expect(order(spanEntries([row("5")], textOf("5", "6"), "6"))).toStrictEqual(
      ["=6"]
    );
    expect(order(spanEntries([row("5")], textOf("5", "6"), "5"))).toStrictEqual(
      ["~5"]
    );
  });

  it("returns only the rows without a text", () => {
    expect(
      order(spanEntries([row("9"), row("2")], undefined, ""))
    ).toStrictEqual(["~2", "~9"]);
  });

  it("reads each pasal once when the text repeats a number", () => {
    const entries = spanEntries([], textOf("4", "4"), "");

    expect(order(entries)).toStrictEqual(["=4"]);
  });
});

describe(runName, () => {
  it("names one pasal and a range", () => {
    const [run] = spanEntries([], textOf("76", "77", "80"), "");

    expect(run.kind === "same" && runName(run.pasal)).toBe("Pasal 76–80");
    expect(runName(run.kind === "same" ? run.pasal.slice(0, 1) : [])).toBe(
      "Pasal 76"
    );
  });
});

const version = (id: string, date: string) => ({
  id,
  label: id,
  cite: id,
  date,
});

describe(textSource, () => {
  const versions = [
    version("uu_4_2009", "2009-01-12"),
    version("uu_3_2020", "2020-06-10"),
    version("uu_2_2025", "2025-03-19"),
  ];

  const listed = [
    { date: "2009-01-12", href: "/uu/4/2009/" },
    { date: "2020-06-10", href: "/koleksi/minerba/2020-06-10/" },
    { date: "2025-03-19", href: "/koleksi/minerba/" },
  ];

  const pick = (chosen: string[], pageDate: string | null) =>
    textSource("minerba", { chosen, versions }, pageDate, listed);

  it("uses the page's own text when its version is a column", () => {
    expect(pick(["uu_3_2020", "uu_2_2025"], "2025-03-19")).toStrictEqual({
      from: "page",
    });
  });

  it("falls back to the newest column's version", () => {
    expect(pick(["uu_4_2009", "uu_3_2020"], "2025-03-19")).toStrictEqual({
      from: "collection",
      version: "2020-06-10",
    });
  });

  it("reads the first version from its law", () => {
    expect(pick(["uu_4_2009"], "2025-03-19")).toStrictEqual({
      from: "law",
      path: "/uu/4/2009/",
    });
  });

  it("reads the latest version as latest", () => {
    expect(pick(["uu_4_2009", "uu_2_2025"], "2020-06-10")).toStrictEqual({
      from: "collection",
      version: "latest",
    });
  });

  it("has no source without columns, and reads a law when the page has no date", () => {
    expect(pick([], null)).toBeUndefined();
    expect(pick(["uu_4_2009"], null)).toStrictEqual({
      from: "law",
      path: "/uu/4/2009/",
    });
  });
});

const pairOf = (...nums: string[]) => ({
  pasal: nums.map((num) => ({
    num,
    before: "text" as const,
    after: "text" as const,
    lines: [],
  })),
});

describe("spanEntries over compareColumns", () => {
  const listedVersions = [
    { id: "a", label: "a", cite: "A", date: null, gap: 0 },
    { id: "b", label: "b", cite: "B", date: null, gap: 0 },
    { id: "c", label: "c", cite: "C", date: null, gap: 0 },
  ];

  const text = textOf("1", "2", "3", "4", "5");

  it("treats a pasal changed in either neighbouring pair as changed (three columns)", () => {
    const { rows } = compareColumns(
      listedVersions,
      { requested: true, unknown: false, columns: [0, 1, 2] },
      [pairOf("2"), pairOf("4")]
    );

    expect(order(spanEntries(rows, text, ""))).toStrictEqual([
      "=1",
      "~2",
      "=3",
      "~4",
      "=5",
    ]);
  });

  it("lists every other pasal as unchanged (two columns)", () => {
    const { rows } = compareColumns(
      listedVersions,
      { requested: true, unknown: false, columns: [0, 2] },
      [pairOf("3")]
    );

    expect(order(spanEntries(rows, text, ""))).toStrictEqual([
      "=1,2",
      "~3",
      "=4,5",
    ]);
  });
});
