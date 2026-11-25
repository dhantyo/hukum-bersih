import { describe, expect, it } from "vitest";

import type {
  CollectionVersions,
  PairPasal,
  VersionPair,
} from "../server/records/collection-comparison.ts";
import type { DiffLine } from "../server/records/diff-line.ts";
import { compareVersions, pickPair } from "./collection-compare.ts";

const versions: CollectionVersions = [
  {
    id: "uu_1_2000",
    label: "Teks asli",
    cite: "UU 1/2000",
    date: null,
    gap: 0,
  },
  {
    id: "uu_2_2010",
    label: "UU 2/2010",
    cite: "UU 2/2010",
    date: "2010-01-01",
    gap: 1,
  },
  {
    id: "uu_3_2020",
    label: "UU 3/2020",
    cite: "UU 3/2020",
    date: "2020-01-01",
    gap: 0,
  },
];

const ids = versions.map((version) => version.id);

const part = (value: string, added = false, removed = false) => ({
  value,
  added,
  removed,
});

const reworded = {
  kind: "berubah",
  a: { num: "(1)", indent: 0 },
  b: { num: "(1)", indent: 0 },
  parts: [
    part("Setiap orang wajib membayar pajak"),
    part(" tepat waktu", true),
    part("."),
  ],
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

const record: VersionPair = {
  pasal: [
    pasal("1", "text", "text", [reworded]),
    pasal("2", "absent", "text", [inserted]),
    pasal("3", "text", "deleted", [removed]),
    pasal("4", "text", "unreadable", [removed]),
    pasal("5", "unreadable", "text", [inserted]),
    pasal("6", "text", "absent", [removed]),
  ],
};

const compare = (bandingkan?: string, dari?: string, pair = record) => {
  const selection = pickPair(ids, bandingkan, dari);

  return compareVersions(
    versions,
    selection,
    selection.pair === undefined ? null : pair
  );
};

describe(compareVersions, () => {
  it("compares nothing until a version is asked for", () => {
    const view = compare();

    expect(view.selected).toBeNull();
    expect(view.changed).toStrictEqual([]);
    expect(view.versions.map((version) => version.id)).toStrictEqual(ids);
  });

  it("lists each pasal that differs with how it changed", () => {
    const view = compare("uu_3_2020", "uu_1_2000");

    expect(view.selected).toStrictEqual({ from: "uu_1_2000", to: "uu_3_2020" });

    expect(view.changed.map(({ num, status }) => [num, status])).toStrictEqual([
      ["1", "berubah"],
      ["2", "baru"],
      ["3", "dihapus"],
      ["4", "belum-terbaca"],
      ["5", "baru"],
      ["6", "belum-ada"],
    ]);
  });

  it("keeps the added words of a changed ayat and the number of each line", () => {
    const [first] = compare("uu_3_2020", "uu_1_2000").changed;

    expect(first.lines).toStrictEqual([
      { kind: "berubah", num: "(1)", indent: 0, parts: reworded.parts },
    ]);
  });

  it("shows nothing of a pasal whose new wording could not be read, and says its old one was", () => {
    const view = compare("uu_3_2020", "uu_1_2000");

    expect(view.changed[3].lines).toStrictEqual([]);
    expect(view.changed[4].previousUnreadable).toBeTruthy();
    expect(view.changed[0].previousUnreadable).toBeFalsy();
  });

  it("reports the amendments missing between the two versions", () => {
    expect(compare("uu_3_2020", "uu_1_2000").gap).toBe(1);
    expect(compare("uu_3_2020", "uu_2_2010").gap).toBe(0);
    expect(compare("uu_1_2000", "uu_3_2020").gap).toBe(1);
  });

  it("compares a lone version with the one before it, and the latest for an empty one", () => {
    expect(compare("uu_3_2020").selected).toStrictEqual({
      from: "uu_2_2010",
      to: "uu_3_2020",
    });

    expect(compare("").selected?.to).toBe("uu_3_2020");
    expect(compare("uu_1_2000").selected).toBeNull();
  });

  it("flags a version the collection does not have", () => {
    const view = compare("uu_9_9999");

    expect(view.unknown).toBeTruthy();
    expect(view.selected).toBeNull();
  });
});
