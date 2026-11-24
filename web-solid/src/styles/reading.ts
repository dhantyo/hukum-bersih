import * as stylex from "@stylexjs/stylex";

import { css } from "./css.ts";
import { color, font, size, space } from "./tokens.stylex.ts";

const ASLI = ':is([data-format="asli"])';

const MODERN_SERIF =
  ':is(:not([data-format="asli"])[data-font-modern="serif"])';

const MODERN_LITERATA =
  ':is(:not([data-format="asli"])[data-font-modern="literata"])';

const MODERN_SANS = ':is(:not([data-format="asli"])[data-font-modern="sans"])';
const ASLI_LITERATA = ':is([data-format="asli"][data-font-asli="literata"])';
const ASLI_SANS = ':is([data-format="asli"][data-font-asli="sans"])';
const ASLI_ATKINSON = ':is([data-format="asli"][data-font-asli="atkinson"])';
const LARGE = ':is([data-size="large"])';

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
      [stylex.when.ancestor(ASLI)]: font.sourceSerif,
      [stylex.when.ancestor(MODERN_SERIF)]: font.sourceSerif,
      [stylex.when.ancestor(MODERN_LITERATA)]: font.literata,
      [stylex.when.ancestor(MODERN_SANS)]: font.ui,
      [stylex.when.ancestor(ASLI_LITERATA)]: font.literata,
      [stylex.when.ancestor(ASLI_SANS)]: font.ui,
      [stylex.when.ancestor(ASLI_ATKINSON)]: font.atkinson,
    },
    fontSize: {
      default: size.law,
      [stylex.when.ancestor(LARGE)]: size.lawLarge,
    },
    lineHeight: 1.65,
  },
  originalLabel: {
    display: {
      default: "none",
      [stylex.when.ancestor(ASLI)]: "inline",
    },
  },
  modernLabel: {
    display: {
      default: null,
      [stylex.when.ancestor(ASLI)]: "none",
    },
  },
});

export const readerClass = css(reading.reader, stylex.defaultMarker());
