import * as stylex from "@stylexjs/stylex";

import { color } from "./tokens.stylex.ts";

/** How an inserted and a deleted piece of text is marked, in every comparison of law text. */
export const changes = stylex.create({
  ins: {
    textDecoration: "none",
    backgroundColor: color.insBackground,
    color: color.insText,
  },
  del: {
    backgroundColor: color.delBackground,
    color: color.delText,
  },
});
