import { test } from "node:test";
import assert from "node:assert/strict";
import { nextBarOffset, settledBarOffset } from "./barscroll.ts";

test("header follows the scroll distance, within 0..height", () => {
  assert.equal(nextBarOffset(0, 500, 530, 60), 30);    // down 30: 30 hidden
  assert.equal(nextBarOffset(30, 530, 600, 60), 60);   // further down: fully hidden, no more
  assert.equal(nextBarOffset(60, 600, 580, 60), 40);   // up 20: 20 back
  assert.equal(nextBarOffset(40, 580, 0, 60), 0);      // at the top: shown
  assert.equal(nextBarOffset(0, 0, 20, 60), 20);       // near the top: never more than scrolled
});

test("a half-hidden header settles", () => {
  assert.equal(settledBarOffset(40, 800, 60), 60);     // mostly hidden, far down: hide
  assert.equal(settledBarOffset(20, 800, 60), 0);      // mostly shown: show
  assert.equal(settledBarOffset(40, 50, 60), 0);       // still within the header's height: show
  assert.equal(settledBarOffset(60, 800, 60), 60);     // already settled
});

test("a header the reader was pulling back settles shown", () => {
  assert.equal(settledBarOffset(40, 800, 60, -1), 0);   // last moved up: show even if mostly hidden
  assert.equal(settledBarOffset(40, 800, 60, 1), 60);   // last moved down: hide
});
