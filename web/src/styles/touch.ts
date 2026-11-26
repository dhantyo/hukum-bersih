import * as stylex from "@stylexjs/stylex";

import { media, space } from "./tokens.stylex.ts";

/** A small link inside running text: on a touch screen its box grows to a comfortable height without moving the text. */
export const touch = stylex.create({
  link: {
    marginBlock: { default: null, [media.touch]: `calc(-1 * ${space.s3})` },
    paddingBlock: { default: null, [media.touch]: space.s3 },
    display: { default: null, [media.touch]: "inline-block" },
  },
});
