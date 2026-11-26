import { describe, expect, it } from "vitest";

import {
  excerptParts,
  hitTitle,
  isRelated,
  searchWords,
  withoutHeading,
} from "./search-excerpt.ts";

describe(excerptParts, () => {
  it("splits an excerpt into plain and marked text", () => {
    expect(excerptParts("a <mark>b</mark> c")).toStrictEqual([
      { text: "a ", marked: false },
      { text: "b", marked: true },
      { text: " c", marked: false },
    ]);
  });

  it("shows the characters Pagefind escaped, not their entities", () => {
    expect(excerptParts("PT &amp; CV &lt;1&gt;")).toStrictEqual([
      { text: "PT & CV <1>", marked: false },
    ]);
  });
});

describe(withoutHeading, () => {
  it("drops the heading the content repeats, marked or not", () => {
    expect(withoutHeading("Pasal 76. (1) isi")).toBe("(1) isi");
    expect(withoutHeading("<mark>Pasal</mark> 5A. isi")).toBe("isi");
  });

  it("keeps text that only mentions a pasal", () => {
    expect(withoutHeading("sesuai Pasal 5 ayat (1)")).toBe(
      "sesuai Pasal 5 ayat (1)"
    );
  });
});

describe(isRelated, () => {
  it("accepts an excerpt that highlights a query word", () => {
    expect(
      isRelated("<mark>Informasi</mark> lain", ["informasi"])
    ).toBeTruthy();
  });

  it("rejects the prefix fallback of a word the index does not have", () => {
    expect(isRelated("<mark>q</mark>uorum", ["qqzzvv"])).toBeFalsy();
  });

  it("accepts anything when no word says what to find", () => {
    expect(isRelated("isi", [])).toBeTruthy();
  });
});

describe(searchWords, () => {
  it("leaves out the words every record has", () => {
    expect(searchWords("pasal 27 UU ITE")).toStrictEqual(["27", "ite"]);
  });
});

describe(hitTitle, () => {
  it("names a law by its citation, as the catalog does", () => {
    expect(hitTitle("/uu/3/2011/", "Transfer Dana")).toBe(
      "UU 3/2011 tentang Transfer Dana"
    );
  });

  it("leaves the title of anything else", () => {
    expect(hitTitle("/koleksi/ite/", "UU ITE")).toBe("UU ITE");
  });
});
