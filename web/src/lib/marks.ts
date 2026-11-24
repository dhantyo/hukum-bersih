// Change marks after Fedlex's comparison view: a pasal inserted (square with plus), deleted
// (square with minus) or changed (square with a dot). Inline SVG so they look the same in every
// font; coloured by the element they sit in (currentColor). Used by components/CompareMode.astro
// in the legend, the contents and the contents' BAB counts.
const box = `<rect x="2.5" y="2.5" width="11" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/>`;
const svg = (inner: string, label: string) =>
  `<svg class="mark" viewBox="0 0 16 16" width="14" height="14" role="img" aria-label="${label}">${box}${inner}</svg>`;

export const MARK = {
  ins: svg(`<path d="M8 5.2v5.6M5.2 8h5.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>`, "disisipkan"),
  del: svg(`<path d="M5.2 8h5.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>`, "dihapus"),
  mod: svg(`<rect x="6" y="6" width="4" height="4" rx="0.8" fill="currentColor"/>`, "diubah"),
} as const;
export type MarkKind = keyof typeof MARK;
