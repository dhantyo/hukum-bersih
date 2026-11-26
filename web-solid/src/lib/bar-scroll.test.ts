import { describe, expect, it } from "vitest";

import { shownPx, step } from "./bar-scroll.ts";
import type { HeaderMode } from "./bar-scroll.ts";

const HEIGHT = 60;

const modesAfterEach = (from: HeaderMode, tops: number[]) => {
  let mode = from;
  let last = tops[0] ?? 0;

  return tops.slice(1).map((top) => {
    mode = step(mode, last, top, HEIGHT);
    last = top;

    return mode;
  });
};

describe("header following the scroll", () => {
  it("scrolls away in its place at the top of the page, then stays hidden", () => {
    expect(modesAfterEach("free", [0, 20, 40, 60, 500])).toStrictEqual([
      "free",
      "free",
      "hidden",
      "hidden",
    ]);
    expect(shownPx("free", 20, HEIGHT)).toBe(40);
  });

  it("comes back whole on the first step up, however small", () => {
    expect(modesAfterEach("hidden", [2000, 1990, 1970, 1800])).toStrictEqual([
      "pinned",
      "pinned",
      "pinned",
    ]);
    expect(shownPx("pinned", 1990, HEIGHT)).toBe(HEIGHT);
  });

  it("slides away again on the first step down", () => {
    expect(modesAfterEach("pinned", [1000, 1001, 990, 1100])).toStrictEqual([
      "hidden",
      "pinned",
      "hidden",
    ]);
  });

  it("comes back after a jump into the page while still in its place", () => {
    expect(step("free", 3000, 2990, HEIGHT)).toBe("pinned");
  });

  it("sits in its place at the top of the page", () => {
    expect(step("pinned", 30, 0, HEIGHT)).toBe("free");
    expect(step("hidden", 30, -5, HEIGHT)).toBe("free");
    expect(step("free", 40, 10, HEIGHT)).toBe("free");
  });
});
