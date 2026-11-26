import * as stylex from "@stylexjs/stylex";

/**
 * Where each compared text column is while the reader moves a version pill, one entry per column
 * (`lib/column-shift.ts` writes them on `<html>`, `components/compare-block.tsx` reads them):
 * how far it is moved sideways, how faint it is, and how long its change of place takes.
 */
export const columnShift = stylex.defineVars({
  shift0: "0px",
  shift1: "0px",
  shift2: "0px",
  shift3: "0px",
  shift4: "0px",
  shift5: "0px",
});

export const columnDim = stylex.defineVars({
  dim0: "1",
  dim1: "1",
  dim2: "1",
  dim3: "1",
  dim4: "1",
  dim5: "1",
});

export const columnGlide = stylex.defineVars({
  glide0: "0s",
  glide1: "0s",
  glide2: "0s",
  glide3: "0s",
  glide4: "0s",
  glide5: "0s",
});

/** The room a held pill may travel: the writer sets both on the pill itself. */
export const pillRange = stylex.defineVars({
  least: "0px",
  most: "0px",
});
