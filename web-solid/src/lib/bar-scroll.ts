/**
 * Where the site header is while the page scrolls. It behaves like a phone browser's address bar:
 * scrolling down it goes away with the page, scrolling up it comes back by the distance scrolled
 * up, and when the scroll stops halfway it settles fully shown or fully hidden. The same rules as
 * `web/src/lib/barscroll.ts`.
 *
 * The browser moves the header, like the text, so it never lags the page: it is placed in the page
 * (`free`, at document position `y`) and scrolls with it, and script only switches it between
 * that, pinned to the top of the window and hidden above it, at the moments it has to.
 */
export type HeaderState =
  | { mode: "free"; y: number }
  | { mode: "pinned" }
  | { mode: "hidden" };

const free = (y: number) =>
  ({ mode: "free", y }) as const satisfies HeaderState;

const PINNED = { mode: "pinned" } as const satisfies HeaderState;

/** The state after a scroll from `last` to `top` (px), for a header `height` px tall. */
export const step = (
  state: HeaderState,
  last: number,
  top: number,
  height: number
) => {
  if (top <= 0) {
    return free(0);
  }

  if (top > last) {
    return state.mode === "pinned" ? free(last) : state;
  }

  if (top === last || state.mode === "pinned") {
    return state;
  }

  const y = state.mode === "hidden" ? last - height : state.y;
  const placed = Math.max(y, last - height);

  return top <= placed ? PINNED : free(placed);
};

/** How many px of the header are on screen. */
export const shownPx = (state: HeaderState, top: number, height: number) => {
  if (state.mode === "pinned") {
    return height;
  }

  if (state.mode === "hidden") {
    return 0;
  }

  return Math.max(0, Math.min(height, state.y + height - top));
};

/**
 * Where a half-hidden header comes to rest once the scroll stops, as px pushed up (0 shown,
 * `height` hidden): shown if the last movement was upward (the reader was bringing it back), else
 * hidden if mostly hidden and past the header's own height, else shown.
 */
export const settledBarOffset = (
  offset: number,
  top: number,
  height: number,
  lastDirection = 0
) => {
  if (offset <= 0 || offset >= height) {
    return offset;
  }

  if (lastDirection < 0) {
    return 0;
  }

  return offset > height / 2 && top > height ? height : 0;
};
