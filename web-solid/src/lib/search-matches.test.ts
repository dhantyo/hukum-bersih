import { describe, expect, it } from "vitest";

import type { Catalog } from "../server/records/catalog.ts";
import { searchMatches } from "./search-matches.ts";

const catalog: Catalog = {
  laws: [
    {
      id: "uu_11_2008",
      s: "UU ITE",
      c: "UU 11/2008",
      t: "Informasi dan Transaksi Elektronik",
      n: "11",
      y: 2008,
      st: "diubah",
      m: [],
      k: 2,
      u: "/uu/11/2008/",
    },
    {
      id: "uu_19_2016",
      s: null,
      c: "UU 19/2016",
      t: "Perubahan atas UU 11/2008",
      n: "19",
      y: 2016,
      st: "berlaku",
      m: ["uu_11_2008"],
      k: 0,
      u: "/uu/19/2016/",
    },
    {
      id: "uu_4_2009",
      s: null,
      c: "UU 4/2009",
      t: "Pertambangan Mineral dan Batubara",
      n: "4",
      y: 2009,
      st: null,
      m: [],
      k: 0,
      u: "/uu/4/2009/",
    },
  ],
  koleksi: [
    {
      slug: "ite",
      name: "UU ITE",
      named: true,
      t: "Informasi dan Transaksi Elektronik",
      a: [],
      k: 2,
      u: "/koleksi/ite/",
      mem: [
        ["uu_11_2008", "pokok"],
        ["uu_19_2016", "perubahan pertama"],
        ["uu_gone", "digantikan"],
      ],
    },
  ],
};

describe(searchMatches, () => {
  it("lists a collection with the laws inside it, resolved from the catalog", () => {
    const [collection] = searchMatches("ite", catalog).collections;

    expect(collection).toMatchObject({
      name: "UU ITE",
      subject: "Informasi dan Transaksi Elektronik",
      count: 2,
      changed: 2,
    });

    expect(collection.members).toStrictEqual([
      {
        role: "pokok",
        cite: "UU 11/2008",
        title: "Informasi dan Transaksi Elektronik",
        url: "/uu/11/2008/",
      },
      {
        role: "perubahan pertama",
        cite: "UU 19/2016",
        title: "Perubahan atas UU 11/2008",
        url: "/uu/19/2016/",
      },
      { role: "digantikan", cite: "uu_gone", title: null, url: null },
    ]);
  });

  it("does not list a law again that its collection already shows", () => {
    expect(searchMatches("ite", catalog).laws).toStrictEqual([]);
  });

  it("finds a law by its citation", () => {
    const { laws, collections } = searchMatches("uu 4/2009", catalog);

    expect(collections).toStrictEqual([]);

    expect(laws).toStrictEqual([
      {
        url: "/uu/4/2009/",
        name: "Pertambangan Mineral dan Batubara",
        cite: "UU 4/2009",
        title: null,
        status: null,
        changed: 0,
      },
    ]);
  });

  it("goes straight to a pasal of a named law", () => {
    const [article] = searchMatches("pasal 27 ite", catalog).articles;

    expect(article).toMatchObject({
      label: "Pasal 27 UU ITE",
      url: "/uu/11/2008/#pasal-27",
    });

    expect(article.law.status).toStrictEqual({
      key: "diubah",
      label: "Diubah",
    });
  });
});
