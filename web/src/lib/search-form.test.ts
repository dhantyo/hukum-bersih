import { describe, expect, it } from "vitest";

import { plainSearchUrl, searchUrl } from "./search-form.ts";

describe("the address of a search", () => {
  it("is the static page for an empty search", () => {
    expect(searchUrl("")).toBe("/cari/");
  });

  it("carries the text of the search, encoded", () => {
    expect(searchUrl("uu 11/2020")).toBe("/cari/?q=uu%2011%2F2020");
  });

  it("leads to the server page when the browser cannot search", () => {
    expect(plainSearchUrl("uu 11/2020")).toBe("/cari/hasil/?q=uu%2011%2F2020");
  });
});
