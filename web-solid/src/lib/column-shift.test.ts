import { describe, expect, it } from "vitest";

import {
  crossingDim,
  followShift,
  pillTravel,
  slotShifts,
} from "./column-shift.ts";

const LEFTS = [100, 700];
const CENTRES = [300, 500];

describe(slotShifts, () => {
  it("moves each column to the place its version takes", () => {
    expect(slotShifts(LEFTS, ["a", "b"], ["b", "a"])).toStrictEqual([
      600, -600,
    ]);
  });

  it("leaves the columns where they are when the order is the same", () => {
    expect(slotShifts(LEFTS, ["a", "b"], ["a", "b"])).toStrictEqual([0, 0]);
  });
});

describe(pillTravel, () => {
  it("lets a pill go from the first pill to the last", () => {
    expect(pillTravel(CENTRES, 0)).toStrictEqual({ least: 0, most: 200 });
    expect(pillTravel(CENTRES, 1)).toStrictEqual({ least: -200, most: 0 });
  });
});

describe(followShift, () => {
  it("moves the text column in proportion to the pill", () => {
    expect(followShift(100, CENTRES, LEFTS, 0)).toBe(300);
  });

  it("stops at the last column however far the pointer goes", () => {
    expect(followShift(900, CENTRES, LEFTS, 0)).toBe(600);
  });
});

describe(crossingDim, () => {
  it("leaves a column as printed when it is not crossed", () => {
    expect(crossingDim(0, 600)).toBe(1);
    expect(crossingDim(600, 600)).toBeCloseTo(1);
  });

  it("fades a column most where the two are level", () => {
    expect(crossingDim(300, 600)).toBeCloseTo(0.2);
  });
});
