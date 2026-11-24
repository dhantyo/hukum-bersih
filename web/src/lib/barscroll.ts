// The site header follows the scroll like a phone browser's address bar: scrolling down it goes
// away with the page, scrolling up it comes back by the distance scrolled up, and when the
// scroll stops halfway it settles fully shown or fully hidden. The behaviour is Sapu Berita's
// (src/render/barscroll.ts, same author); used by layouts/Base.astro.
//
// Moving the header from script on every scroll frame lags the page by a frame or more on
// phones (the page scrolls on the compositor, the script runs after), which reads as stutter.
// So the header is moved by the browser itself, like the text: it is placed in the page
// ("free", at document position y) and scrolls with it; script only switches it between that,
// pinned to the top of the window, and hidden above it, at the moments it has to.

export type HeaderState =
  | { mode: "free"; y: number }    // in the page at document y (px): scrolls with the text
  | { mode: "pinned" }             // fixed at the top of the window, fully shown
  | { mode: "hidden" };            // fixed just above the window

/** The state after a scroll from `last` to `top` (px), for a header `h` px tall. */
export function step(s: HeaderState, last: number, top: number, h: number): HeaderState {
  if (top <= 0) return { mode: "free", y: 0 };
  if (top > last) {
    // down: a pinned header stays where it was in the page and leaves with it
    return s.mode === "pinned" ? { mode: "free", y: last } : s;
  }
  if (top < last) {
    if (s.mode === "pinned") return s;
    // up: a header out of view is put just above the window, shown by the distance scrolled up
    let y = s.mode === "hidden" ? last - h : s.y;
    if (y + h < last) y = last - h;
    // once it is all in view it pins
    return top <= y ? { mode: "pinned" } : { mode: "free", y };
  }
  return s;
}

/** How many px of the header are on screen. */
export function shownPx(s: HeaderState, top: number, h: number): number {
  return s.mode === "pinned" ? h : s.mode === "hidden" ? 0 : Math.max(0, Math.min(h, s.y + h - top));
}

/** Where a half-hidden header comes to rest once the scroll stops, as px pushed up (0 shown, h
 * hidden): shown if the last movement was upward (the reader was bringing it back; added here,
 * Sapu Berita settles by position only), else hidden if mostly hidden and past the header's own
 * height, else shown. */
export function settledBarOffset(offset: number, top: number, height: number, lastDirection = 0): number {
  if (offset <= 0 || offset >= height) return offset;
  if (lastDirection < 0) return 0;
  return offset > height / 2 && top > height ? height : 0;
}
