import * as stylex from "@stylexjs/stylex";

import { color, size, space } from "./tokens.stylex.ts";

/** Parts shared by the blocks of a document page's side panel. */
export const panel = stylex.create({
  title: {
    margin: 0,
    color: color.textMuted,
    fontSize: size.xs,
    fontWeight: 600,
    letterSpacing: "0.06em",
    marginBlockEnd: space.s2,
    textTransform: "uppercase",
  },
  block: { marginBlockEnd: space.s5 },
  list: { margin: 0, padding: 0, listStyle: "none" },
  note: {
    color: color.textMuted,
    fontSize: size.xs,
    marginBlockStart: space.s2,
  },
});
