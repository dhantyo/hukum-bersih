// The site header follows the scroll like a phone browser's address bar: scrolling down slides it
// away by exactly the distance scrolled, scrolling up brings it back the same way, and when the
// scroll stops halfway it settles to fully shown or fully hidden. Ported from Sapu Berita
// (src/render/barscroll.ts, same author); used by layouts/Base.astro.

/**
 * How far (px) the header is pushed up after a scroll from prevTop to top. 0 = fully shown,
 * height = fully hidden. Near the top of the page it is never hidden by more than the distance
 * scrolled, so it can't vanish while the reader is still at the top.
 */
export function nextBarOffset(offset: number, prevTop: number, top: number, height: number): number {
  if (top <= 0) return 0;
  const next = Math.max(0, Math.min(height, offset + (top - prevTop)));
  return Math.min(next, top);
}

/** Where a half-hidden header comes to rest once the scroll stops: shown if the last movement
 * was upward (the reader was bringing it back; added here, Sapu Berita settles by position
 * only), else hidden if mostly hidden and past the header's own height, else shown. */
export function settledBarOffset(offset: number, top: number, height: number, lastDirection = 0): number {
  if (offset <= 0 || offset >= height) return offset;
  if (lastDirection < 0) return 0;
  return offset > height / 2 && top > height ? height : 0;
}
