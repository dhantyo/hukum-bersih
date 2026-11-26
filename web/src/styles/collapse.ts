import * as stylex from "@stylexjs/stylex";

import { motion } from "./motion.stylex.ts";

const ANIMATING = ":is([data-starting-style], [data-ending-style])";

const duration = motion.collapseDuration;
const easing = motion.collapseEasing;

export const collapse = stylex.create({
  panel: {
    overflow: "hidden",
    transition: {
      [motion.reduced]: "none",
      default: `height ${duration} ${easing}`,
    },
    height: {
      [ANIMATING]: 0,
      default: "var(--collapsible-panel-height)",
    },
  },
  turn: {
    transition: {
      [motion.reduced]: "none",
      default: `transform ${duration} ${easing}`,
    },
  },
  triggerArrow: {
    "::after": {
      transition: {
        [motion.reduced]: "none",
        default: `transform ${duration} ${easing}`,
      },
    },
  },
});
