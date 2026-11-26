import { describe, expect, it } from "vitest";

import { shiftToKeep } from "./fold-motion.ts";

describe(shiftToKeep, () => {
  it("scrolls by how far an element on screen moved", () => {
    expect(shiftToKeep(120, 420)).toBe(300);
    expect(shiftToKeep(120, 120)).toBe(0);
  });

  it("brings an element that began above the window to its top edge", () => {
    expect(shiftToKeep(-500, 40)).toBe(40);
  });
});
