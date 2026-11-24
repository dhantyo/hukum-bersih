import * as stylex from "@stylexjs/stylex";

export const accessibility = stylex.create({
  visuallyHidden: {
    overflow: "hidden",
    position: "absolute",
    height: 1,
    width: 1,
  },
});
