import { describe, expect, it } from "vitest";

import type { CollectionComparison } from "../server/records/collection-comparison.ts";
import { compareVersions } from "./collection-compare.ts";

const data: CollectionComparison = {
  versions: [
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
  ],
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
    [
      "4",
      [
        [0, [[null, "Lama.", 0]]],
        [1, "u"],
      ],
    ],
  ],
};

describe(compareVersions, () => {
  it("compares nothing until a version is asked for", () => {
    const view = compareVersions(data);

    expect(view.selected).toBeNull();
    expect(view.changed).toStrictEqual([]);
    expect(view.versions.map((version) => version.id)).toStrictEqual([
      "uu_1_2000",
      "uu_2_2010",
      "uu_3_2020",
    ]);
  });

  it("lists only the pasal that differ, each with how it changed", () => {
    const view = compareVersions(data, "uu_3_2020", "uu_1_2000");

    expect(view.selected).toStrictEqual({ from: "uu_1_2000", to: "uu_3_2020" });

    expect(view.changed.map(({ num, status }) => [num, status])).toStrictEqual([
      ["1", "berubah"],
      ["2", "baru"],
      ["3", "dihapus"],
      ["4", "belum-terbaca"],
    ]);

    const [first] = view.changed;

    const inserted = first.lines.flatMap((line) =>
      line.parts.filter((part) => part.added === true)
    );

    expect(inserted.map((part) => part.value.trim())).toStrictEqual([
      "tepat waktu",
    ]);
  });

  it("reports the amendments missing between the two versions", () => {
    expect(compareVersions(data, "uu_3_2020", "uu_1_2000").gap).toBe(1);
    expect(compareVersions(data, "uu_3_2020", "uu_2_2010").gap).toBe(0);
  });

  it("compares a lone version with the one before it, and the latest for an empty one", () => {
    expect(compareVersions(data, "uu_3_2020").selected).toStrictEqual({
      from: "uu_2_2010",
      to: "uu_3_2020",
    });

    expect(compareVersions(data, "").selected?.to).toBe("uu_3_2020");
    expect(compareVersions(data, "uu_1_2000").selected).toBeNull();
  });

  it("flags a version the collection does not have", () => {
    const view = compareVersions(data, "uu_9_9999");

    expect(view.unknown).toBeTruthy();
    expect(view.selected).toBeNull();
  });
});
