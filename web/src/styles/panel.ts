import * as stylex from "@stylexjs/stylex";

import { versionLink } from "./markers.stylex.ts";
import { color, media, size, space } from "./tokens.stylex.ts";

const OPEN = ":is([data-open])";
const CHEVRON_TURN_OVERHANG = 2;
const DOT = 9;
const LINE_START = 4;
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
  list: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    position: "relative",
    "::before": {
      insetBlock: space.s2,
      backgroundColor: color.line,
      content: '""',
      inlineSize: 1,
      insetInlineStart: LINE_START,
      position: "absolute",
    },
  },
  row: {
    borderRadius: size.radius,
    paddingBlock: space.s1,
    paddingInlineStart: space.s5,
    position: "relative",
  },
  rowHere: {
    backgroundColor: color.linkBackground,
    marginInlineStart: `calc(-1 * ${space.s1})`,
    paddingInlineStart: `calc(${space.s5} + ${space.s1})`,
  },
  dot: {
    borderRadius: "50%",
    backgroundColor: color.gone,
    blockSize: DOT,
    boxShadow: `0 0 0 3px ${color.background}`,
    inlineSize: DOT,
    insetBlockStart: `calc(${space.s1} + 0.35em)`,
    insetInlineStart: 0,
    position: "absolute",
  },
  dotNow: { backgroundColor: color.ok },
  dotMissing: {
    borderColor: color.gone,
    borderStyle: "dashed",
    borderWidth: 1,
    backgroundColor: color.background,
    boxSizing: "border-box",
  },
  dotHere: { insetInlineStart: space.s1 },
  entry: {
    borderRadius: size.radius,
    paddingBlock: { default: null, [media.touch]: space.s2 },
    textDecoration: "none",
    color: color.text,
    display: "grid",
  },
  when: {
    color: color.textMuted,
    fontSize: size.xs,
    fontVariantNumeric: "tabular-nums",
  },
  what: {
    textDecoration: { [LINK_HOVERED]: "underline", default: null },
    color: { [LINK_HOVERED]: color.link, default: null },
    fontWeight: 600,
  },
  whatHere: { color: color.link },
  whatMissing: { color: color.textMuted, fontWeight: 400 },
  state: { color: color.ok, fontWeight: 400 },
  sub: { color: color.textMuted, display: "block", fontSize: size.xs },
  compare: {
    borderColor: { default: color.lineStrong, ":hover": color.link },
    borderRadius: size.radius,
    borderStyle: "solid",
    borderWidth: 1,
    paddingBlock: space.s2,
    paddingInline: space.s3,
    textDecoration: "none",
    backgroundColor: {
      default: color.background,
      ":hover": color.linkBackground,
    },
    boxSizing: "border-box",
    color: color.link,
    display: "block",
    fontWeight: 600,
    inlineSize: "100%",
    marginBlockStart: space.s3,
    textAlign: "center",
  },
});
