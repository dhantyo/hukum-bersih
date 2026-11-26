import * as stylex from "@stylexjs/stylex";

export const accessibility = stylex.create({
  visuallyHidden: {
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    position: "absolute",
    whiteSpace: "nowrap",
    height: 1,
    width: 1,
  },
});
