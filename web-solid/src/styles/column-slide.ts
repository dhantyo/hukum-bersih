import * as stylex from "@stylexjs/stylex";

import { columnDim, columnGlide, columnShift } from "./column-shift.stylex.ts";
import { motion } from "./motion.stylex.ts";

const SLIDING = ":is([data-cmp-sliding])";
const PROPERTIES = "translate, opacity";

const styles = stylex.create({
  column0: {
    opacity: { default: 1, [stylex.when.ancestor(SLIDING)]: columnDim.dim0 },
    transitionDuration: {
      default: null,
      [stylex.when.ancestor(SLIDING)]: columnGlide.glide0,
    },
    transitionProperty: {
      default: null,
      [stylex.when.ancestor(SLIDING)]: PROPERTIES,
    },
    transitionTimingFunction: motion.glideEasing,
    translate: {
      default: "none",
      [stylex.when.ancestor(SLIDING)]: columnShift.shift0,
    },
  },
  column1: {
    opacity: { default: 1, [stylex.when.ancestor(SLIDING)]: columnDim.dim1 },
    transitionDuration: {
      default: null,
      [stylex.when.ancestor(SLIDING)]: columnGlide.glide1,
    },
    transitionProperty: {
      default: null,
      [stylex.when.ancestor(SLIDING)]: PROPERTIES,
    },
    transitionTimingFunction: motion.glideEasing,
    translate: {
      default: "none",
      [stylex.when.ancestor(SLIDING)]: columnShift.shift1,
    },
  },
  column2: {
    opacity: { default: 1, [stylex.when.ancestor(SLIDING)]: columnDim.dim2 },
    transitionDuration: {
      default: null,
      [stylex.when.ancestor(SLIDING)]: columnGlide.glide2,
    },
    transitionProperty: {
      default: null,
      [stylex.when.ancestor(SLIDING)]: PROPERTIES,
    },
    transitionTimingFunction: motion.glideEasing,
    translate: {
      default: "none",
      [stylex.when.ancestor(SLIDING)]: columnShift.shift2,
    },
  },
  column3: {
    opacity: { default: 1, [stylex.when.ancestor(SLIDING)]: columnDim.dim3 },
    transitionDuration: {
      default: null,
      [stylex.when.ancestor(SLIDING)]: columnGlide.glide3,
    },
    transitionProperty: {
      default: null,
      [stylex.when.ancestor(SLIDING)]: PROPERTIES,
    },
    transitionTimingFunction: motion.glideEasing,
    translate: {
      default: "none",
      [stylex.when.ancestor(SLIDING)]: columnShift.shift3,
    },
  },
  column4: {
    opacity: { default: 1, [stylex.when.ancestor(SLIDING)]: columnDim.dim4 },
    transitionDuration: {
      default: null,
      [stylex.when.ancestor(SLIDING)]: columnGlide.glide4,
    },
    transitionProperty: {
      default: null,
      [stylex.when.ancestor(SLIDING)]: PROPERTIES,
    },
    transitionTimingFunction: motion.glideEasing,
    translate: {
      default: "none",
      [stylex.when.ancestor(SLIDING)]: columnShift.shift4,
    },
  },
  column5: {
    opacity: { default: 1, [stylex.when.ancestor(SLIDING)]: columnDim.dim5 },
    transitionDuration: {
      default: null,
      [stylex.when.ancestor(SLIDING)]: columnGlide.glide5,
    },
    transitionProperty: {
      default: null,
      [stylex.when.ancestor(SLIDING)]: PROPERTIES,
    },
    transitionTimingFunction: motion.glideEasing,
    translate: {
      default: "none",
      [stylex.when.ancestor(SLIDING)]: columnShift.shift5,
    },
  },
});

const byColumn = [
  styles.column0,
  styles.column1,
  styles.column2,
  styles.column3,
  styles.column4,
  styles.column5,
];

/**
 * The style that lets the text column `index` (from 0) move with its version's pill while the
 * reader drags it (`lib/column-shift.ts` sets the values); a column past the sixth stays put.
 */
export const slidingColumn = (index: number) => byColumn[index] ?? null;
