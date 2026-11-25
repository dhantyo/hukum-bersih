import * as stylex from "@stylexjs/stylex";

import { css } from "./css.ts";
import { color } from "./tokens.stylex.ts";

export const linkStyles = stylex.create({
  base: { color: color.link },
});

export const linkClass = css(linkStyles.base);
