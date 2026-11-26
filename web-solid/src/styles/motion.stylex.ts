import * as stylex from "@stylexjs/stylex";

export const motion = stylex.defineConsts({
  liftTransition:
    "box-shadow 0.25s ease, scale 0.45s linear(0, 0.38 8%, 0.82 16%, 1.08 26%, 1.1 32%, 1.05 42%, 0.99 56%, 1.003 72%, 1)",
  reduced: "@media (prefers-reduced-motion: reduce)",
});
