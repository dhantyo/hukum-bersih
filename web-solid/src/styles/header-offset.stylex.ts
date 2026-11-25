import * as stylex from "@stylexjs/stylex";

/**
 * How much of the site header covers the top of the window right now: its height while it is
 * pinned, else 0. `lib/header-follow.ts` writes it on `<html>`; a sticky element reads it to sit
 * below the header (`top: calc(<its offset> + ${headerOffset.shown})`).
 */
export const headerOffset = stylex.defineVars({
  shown: "0px",
});
