import * as stylex from "@stylexjs/stylex";

import { versionLink } from "./markers.stylex.ts";
import { color, media, size, space } from "./tokens.stylex.ts";

const OPEN = ":is([data-open])";
const CHEVRON_TURN_OVERHANG = 2;
const LEAD = `calc(${space.s3} + 2px)`;
const LINK_HOVERED = stylex.when.ancestor(":hover", versionLink);

/** Parts shared by the blocks of a document page's side panel. */
export const panel = stylex.create({
  title: {
    margin: 0,
    color: color.textMuted,
    fontSize: size.sm,
    fontWeight: 600,
  },
  block: { marginBlockEnd: space.s6 },
  list: { margin: 0, padding: 0, listStyle: "none" },
  note: {
    margin: 0,
    color: color.textMuted,
    fontSize: size.xs,
    marginBlockStart: space.s3,
  },
});

/** The "Versi" list, on a law page and on a collection page. */
export const versions = stylex.create({
  trigger: {
    borderWidth: 0,
    gap: space.s2,
    paddingBlock: 0,
    paddingInline: 0,
    alignItems: "baseline",
    backgroundColor: "transparent",
    color: "inherit",
    cursor: "pointer",
    display: "flex",
    fontFamily: "inherit",
    inlineSize: "100%",
    marginBlockEnd: space.s2,
    outlineColor: color.link,
    outlineOffset: { default: null, ":focus-visible": 2 },
    outlineStyle: { default: null, ":focus-visible": "solid" },
    outlineWidth: { default: null, ":focus-visible": 3 },
    textAlign: "start",
    "::after": {
      alignSelf: "center",
      blockSize: 6,
      borderBlockEndColor: color.textMuted,
      borderBlockEndStyle: "solid",
      borderBlockEndWidth: 1.5,
      borderInlineEndColor: color.textMuted,
      borderInlineEndStyle: "solid",
      borderInlineEndWidth: 1.5,
      content: '""',
      inlineSize: 6,
      marginInlineEnd: CHEVRON_TURN_OVERHANG,
      marginInlineStart: "auto",
      transform: { [OPEN]: "rotate(-135deg)", default: "rotate(45deg)" },
    },
  },
  count: { color: color.textMuted, fontSize: size.xs },
  entry: {
    paddingBlock: {
      default: space.s2,
      [media.touch]: space.s3,
    },
    paddingInline: space.s3,
    textDecoration: "none",
    borderInlineStartColor: "transparent",
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: 2,
    color: color.text,
    display: "grid",
  },
  entryHere: { borderInlineStartColor: color.link },
  when: {
    color: color.textMuted,
    fontSize: size.xs,
    fontVariantNumeric: "tabular-nums",
  },
  what: {
    textDecoration: { [LINK_HOVERED]: "underline", default: null },
    color: { [LINK_HOVERED]: color.link, default: null },
  },
  whatHere: { color: color.link, fontWeight: 600 },
  whatMissing: { color: color.textMuted },
  state: { color: color.ok },
  sub: { color: color.textMuted, display: "block", fontSize: size.xs },
  compare: {
    paddingBlock: space.s1,
    display: "inline-block",
    marginBlockStart: space.s2,
    marginInlineStart: LEAD,
  },
  noteIndent: { marginInlineStart: LEAD },
});
