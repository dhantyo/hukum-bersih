import { describe, expect, it } from "vitest";

import { cukupJelas, modernHeading, modernLabel, pasalKey } from "./display.ts";
import { tanggal } from "./labels.ts";
import { citeOf, norm, pasalOf } from "./search-query.ts";

describe(modernHeading, () => {
  it("writes a heading in capitals as a title, keeping acronyms and small words", () => {
    expect(modernHeading("PELINDUNGAN SAKSI DAN KORBAN")).toBe(
      "Pelindungan Saksi dan Korban"
    );
    expect(modernHeading("KETENTUAN UMUM UU ITE")).toBe(
      "Ketentuan Umum UU ITE"
    );
  });

  it("leaves a heading that is not in capitals as printed", () => {
    expect(modernHeading("Ketentuan umum")).toBe("Ketentuan umum");
  });
});

describe(modernLabel, () => {
  it.each([
    ["Ayat (1)", "(1)"],
    ["Ayat ( 2a )", "(2a)"],
    ["Huruf d", "d."],
    ["Angka 3", "3."],
    ["Pasal 5", "Pasal 5"],
  ])("shows %s as %s", (label, shown) => {
    expect(modernLabel(label)).toBe(shown);
  });
});

describe(pasalKey, () => {
  it("lowers the case and drops everything but letters and digits", () => {
    expect(pasalKey("45A")).toBe("45a");
    expect(pasalKey("27 (ayat)")).toBe("27ayat");
  });
});

const paragraph = (text: string) => ({
  tag: "p",
  text,
  children: [],
});

describe(cukupJelas, () => {
  it("is true only when every paragraph says so", () => {
    expect(
      cukupJelas({
        tag: "article",
        children: [paragraph("Cukup jelas."), paragraph("cukup  jelas")],
      })
    ).toBeTruthy();

    expect(
      cukupJelas({
        tag: "article",
        children: [paragraph("Cukup jelas."), paragraph("Ayat (1) dihapus.")],
      })
    ).toBeFalsy();

    expect(cukupJelas({ tag: "article", children: [] })).toBeFalsy();
  });
});

describe(tanggal, () => {
  it.each([
    ["2026-11-19", "19 November 2026"],
    ["2023-05", "Mei 2023"],
    ["2008", "2008"],
  ])("writes %s as %s", (date, written) => {
    expect(tanggal(date)).toBe(written);
  });
});

describe("search query", () => {
  it("drops case, accents and punctuation but keeps the slash", () => {
    expect(norm("  UU  No. 4/2009 ")).toBe("uu no 4/2009");
  });

  it.each([
    ["uu 4/2009", "4/2009"],
    ["uu no 4 tahun 2009", "4/2009"],
    ["4 2009", "4/2009"],
    ["ite", undefined],
  ])("reads the citation of %s", (query, citation) => {
    expect(citeOf(query)).toBe(citation);
  });

  it.each([
    ["pasal 27 ite", { num: "27", rest: "ite" }],
    ["ite pasal 27", { num: "27", rest: "ite" }],
    ["pasal 5 uu 4/2009", { num: "5", rest: "uu 4/2009" }],
    ["ite", undefined],
  ])("reads the pasal of %s", (query, found) => {
    expect(pasalOf(query)).toStrictEqual(found);
  });
});
