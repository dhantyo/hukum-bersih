import { describe, expect, it } from "vitest";

import { settledBarOffset, shownPx, step } from "./bar-scroll.ts";
import type { HeaderState } from "./bar-scroll.ts";

const HEIGHT = 60;

const shownAfterEach = (from: HeaderState, tops: number[]) => {
  let state = from;
  let last = tops[0] ?? 0;

  return tops.slice(1).map((top) => {
    state = step(state, last, top, HEIGHT);
    last = top;

    return shownPx(state, top, HEIGHT);
  });
};

describe("header following the scroll", () => {
  it("leaves with the page when scrolling down", () => {
    expect(
      shownAfterEach({ mode: "free", y: 0 }, [0, 20, 40, 60, 500])
    ).toStrictEqual([40, 20, 0, 0]);
    expect(
      shownAfterEach({ mode: "pinned" }, [1000, 1030, 1100])
    ).toStrictEqual([30, 0]);
  });

  it("comes back by the distance scrolled up, then pins", () => {
    expect(
      shownAfterEach(
        { mode: "free", y: 0 },
        [2000, 1990, 1970, 1940, 1900, 1800]
      )
    ).toStrictEqual([10, 30, 60, 60, 60]);

    const partly = step({ mode: "hidden" }, 2000, 1975, HEIGHT);
    expect(partly).toStrictEqual({ mode: "free", y: 1940 });
    expect(shownPx(partly, 1975, HEIGHT)).toBe(25);
    expect(step(partly, 1975, 1930, HEIGHT)).toStrictEqual({ mode: "pinned" });
  });

  it("goes again with the page when scrolling down after a partial reveal", () => {
    expect(
      shownAfterEach({ mode: "free", y: 0 }, [2000, 1980, 1990, 2010])
    ).toStrictEqual([20, 10, 0]);
  });

  it("sits in its place at the top of the page", () => {
    expect(step({ mode: "pinned" }, 30, 0, HEIGHT)).toStrictEqual({
      mode: "free",
      y: 0,
    });
    expect(step({ mode: "hidden" }, 30, -5, HEIGHT)).toStrictEqual({
      mode: "free",
      y: 0,
    });
  });

  it("settles a half-hidden header hidden only when mostly hidden and far down", () => {
    expect(settledBarOffset(40, 800, HEIGHT)).toBe(60);
    expect(settledBarOffset(20, 800, HEIGHT)).toBe(0);
    expect(settledBarOffset(40, 50, HEIGHT)).toBe(0);
    expect(settledBarOffset(60, 800, HEIGHT)).toBe(60);
  });

  it("settles by the last direction of the scroll", () => {
    expect(settledBarOffset(40, 800, HEIGHT, -1)).toBe(0);
    expect(settledBarOffset(40, 800, HEIGHT, 1)).toBe(60);
  });
});
