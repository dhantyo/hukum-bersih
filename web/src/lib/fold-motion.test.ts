import { describe, expect, it } from "vitest";

import { shiftToKeep, withoutMotion } from "./fold-motion.ts";

describe("fold motion", () => {
  it("scrolls by how far an element on screen moved", () => {
    expect(shiftToKeep(120, 420)).toBe(300);
    expect(shiftToKeep(120, 120)).toBe(0);
  });

  it("brings an element that began above the window to its top edge", () => {
    expect(shiftToKeep(-500, 40)).toBe(40);
  });

  it("keeps motion off until two frames after the change", () => {
    const marks: boolean[] = [];
    const queue: (() => void)[] = [];

    const root = {
      toggleAttribute: (_name: string, force?: boolean) => {
        marks.push(force === true);

        return force === true;
      },
    };

    withoutMotion(
      root,
      () => {
        marks.push(true);
      },
      (step) => {
        queue.push(step);
      }
    );

    expect(marks).toStrictEqual([true, true]);
    queue.shift()?.();
    expect(marks).toStrictEqual([true, true]);
    queue.shift()?.();
    expect(marks).toStrictEqual([true, true, false]);
  });
});
