import { describe, expect, it } from "vitest";

import {
  crossingDim,
  crossingPoses,
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

describe(crossingDim, () => {
  it("leaves a column as printed when it is not crossed", () => {
    expect(crossingDim(0, 600)).toBe(1);
    expect(crossingDim(600, 600)).toBeCloseTo(1);
  });

  it("fades a column most where the two are level", () => {
    expect(crossingDim(300, 600)).toBeCloseTo(0.2);
  });
});

const THREE_LEFTS = [100, 400, 1000];
const THREE_CENTRES = [200, 400, 700];

const shiftsOf = (held: number, pillCentre: number) =>
  crossingPoses(THREE_LEFTS, THREE_CENTRES, held, pillCentre).map(
    (pose) => pose.shift + 0
  );

describe(crossingPoses, () => {
  it("moves the other column opposite to the held one for two columns", () => {
    const [held, other] = crossingPoses(LEFTS, CENTRES, 0, 350);

    expect(held?.shift).toBeCloseTo(150);
    expect(other?.shift).toBeCloseTo(-150);
    expect(other?.dim).toBeCloseTo(crossingDim(150, 600));
  });

  it("slides only the neighbour being crossed when dragging right", () => {
    expect(shiftsOf(0, 300)).toStrictEqual([150, -150, 0]);
  });

  it("keeps the neighbour passed in its swapped place and starts the next", () => {
    expect(shiftsOf(0, 550)).toStrictEqual([600, -300, -300]);
  });

  it("slides the neighbour being crossed when dragging left", () => {
    expect(shiftsOf(2, 550)).toStrictEqual([0, 300, -300]);
  });

  it("leaves every column put when the held pill has not moved", () => {
    expect(shiftsOf(1, 400)).toStrictEqual([0, 0, 0]);
  });

  it("puts both neighbours in their swapped places after a two slot drag", () => {
    expect(shiftsOf(2, 200)).toStrictEqual([300, 600, -900]);
  });
});
