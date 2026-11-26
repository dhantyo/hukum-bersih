import { describe, expect, it } from "vitest";

import { pasalStartsWith } from "./pasal-match.ts";

describe(pasalStartsWith, () => {
  it.each(["27", "Pasal 27", "pasal27", " 27 "])(
    "finds pasal 27 when %j is typed",
    (typed) => {
      expect(pasalStartsWith("27", typed)).toBeTruthy();
    }
  );

  it("finds every pasal that starts with the typed digits", () => {
    expect(pasalStartsWith("270", "27")).toBeTruthy();
    expect(pasalStartsWith("27A", "27")).toBeTruthy();
    expect(pasalStartsWith("127", "27")).toBeFalsy();
  });

  it("matches a lettered pasal however the letter is spaced or cased", () => {
    expect(pasalStartsWith("27A", "27 a")).toBeTruthy();
    expect(pasalStartsWith("27A", "Pasal 27a")).toBeTruthy();
    expect(pasalStartsWith("27B", "27a")).toBeFalsy();
  });

  it("lists every pasal while nothing is typed", () => {
    expect(pasalStartsWith("5", "")).toBeTruthy();
    expect(pasalStartsWith("5", "Pasal ")).toBeTruthy();
  });
});
