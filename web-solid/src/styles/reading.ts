import * as stylex from "@stylexjs/stylex";

import { css } from "./css.ts";
import { color, font, size, space } from "./tokens.stylex.ts";

const asked = ':has(input[value="asli"]:checked)';

export const reading = stylex.create({
  reader: {
    marginBlock: space.s4,
    marginInline: "auto",
    backgroundColor: color.background,
    color: color.text,
    fontFamily: font.ui,
    fontSize: size.base,
    lineHeight: 1.6,
    textAlign: "start",
    maxWidth: size.measure,
  },
  law: {
    fontFamily: {
      default: font.atkinson,
      [stylex.when.ancestor(asked)]: font.sourceSerif,
    },
    fontSize: size.law,
  },
  originalLabel: {
    display: {
      default: "none",
      [stylex.when.ancestor(asked)]: "inline",
    },
  },
  modernLabel: {
    display: {
      default: null,
      [stylex.when.ancestor(asked)]: "none",
    },
  },
});

export const readerClass = css(reading.reader, stylex.defaultMarker());
