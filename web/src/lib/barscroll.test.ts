import { test } from "node:test";
import assert from "node:assert/strict";
import { settledBarOffset, shownPx, step, type HeaderState } from "./barscroll.ts";

const H = 60;
/** scroll through the given positions, returning the px of header shown after each */
const run = (from: HeaderState, tops: number[]) => {
  let s = from, last = tops[0];
  return tops.slice(1).map((top) => { s = step(s, last, top, H); last = top; return shownPx(s, top, H); });
};

test("scrolling down, the header leaves with the page", () => {
  assert.deepEqual(run({ mode: "free", y: 0 }, [0, 20, 40, 60, 500]), [40, 20, 0, 0]);
  // pinned further down: it stays where it was in the page and scrolls away
  assert.deepEqual(run({ mode: "pinned" }, [1000, 1030, 1100]), [30, 0]);
});

test("scrolling up, it comes back by the distance scrolled up, then pins", () => {
  const ups = run({ mode: "free", y: 0 }, [2000, 1990, 1970, 1940, 1900, 1800]);
  assert.deepEqual(ups, [10, 30, 60, 60, 60]);
  let s: HeaderState = { mode: "hidden" };
  s = step(s, 2000, 1975, H);
  assert.deepEqual(s, { mode: "free", y: 1940 });
  assert.equal(shownPx(s, 1975, H), 25);
  assert.deepEqual(step(s, 1975, 1930, H), { mode: "pinned" });
});

test("down after a partial reveal: it goes again with the page", () => {
  assert.deepEqual(run({ mode: "free", y: 0 }, [2000, 1980, 1990, 2010]), [20, 10, 0]);
});

test("at the top of the page it sits in its place", () => {
  assert.deepEqual(step({ mode: "pinned" }, 30, 0, H), { mode: "free", y: 0 });
  assert.deepEqual(step({ mode: "hidden" }, 30, -5, H), { mode: "free", y: 0 });
});

test("a half-hidden header settles", () => {
  assert.equal(settledBarOffset(40, 800, 60), 60);     // mostly hidden, far down: hide
  assert.equal(settledBarOffset(20, 800, 60), 0);      // mostly shown: show
  assert.equal(settledBarOffset(40, 50, 60), 0);       // still within the header's height: show
  assert.equal(settledBarOffset(60, 800, 60), 60);     // already settled
  assert.equal(settledBarOffset(40, 800, 60, -1), 0);  // last moved up: show
  assert.equal(settledBarOffset(40, 800, 60, 1), 60);  // last moved down: hide
});
