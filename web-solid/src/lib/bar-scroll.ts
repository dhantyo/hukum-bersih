/**
 * Where the site header is while the page scrolls. At the top of the page it sits in its place
 * (`free`) and scrolls away with the page. Further down, scrolling down slides it away
 * (`hidden`) and scrolling up slides it back in (`pinned`) at once: each change is one
 * transition, never a header that follows the scroll part of the way and then snaps.
 */
export type HeaderMode = "free" | "pinned" | "hidden";

/** The mode after a scroll from `last` to `top` (px), for a header `height` px tall. */
export const step = (
  mode: HeaderMode,
  last: number,
  top: number,
  height: number
) => {
  if (top <= 0) {
    return "free";
  }

  if (top === last || (mode === "free" && top < height)) {
    return mode;
  }

  return top > last ? "hidden" : "pinned";
};

/** How many px of the header are on screen. */
export const shownPx = (mode: HeaderMode, top: number, height: number) => {
  if (mode === "free") {
    return Math.max(0, height - top);
  }

  return mode === "pinned" ? height : 0;
};
