import * as stylex from "@stylexjs/stylex";

import { css } from "./css.ts";
import { color } from "./tokens.stylex.ts";

export const linkStyles = stylex.create({
  base: {
    borderRadius: { default: null, ":focus-visible": 2 },
    color: color.link,
    outlineColor: color.link,
    outlineOffset: { default: null, ":focus-visible": 2 },
    outlineStyle: { default: null, ":focus-visible": "solid" },
    outlineWidth: { default: null, ":focus-visible": 3 },
    textDecorationThickness: { default: 1, ":hover": 2 },
    textUnderlineOffset: "0.15em",
  },
});

export const linkClass = css(linkStyles.base);
