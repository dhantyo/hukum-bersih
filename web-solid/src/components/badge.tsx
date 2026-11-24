import * as stylex from "@stylexjs/stylex";
import type { ParentProps } from "solid-js";

import { css } from "../styles/css.ts";
import { color, size, space } from "../styles/tokens.stylex.ts";

const styles = stylex.create({
  badge: {
    borderColor: "currentColor",
    borderRadius: 999,
    borderStyle: "solid",
    borderWidth: 1,
    paddingInline: space.s2,
    alignItems: "center",
    display: "inline-flex",
    fontSize: size.xs,
    fontWeight: 600,
    lineHeight: 1.6,
    whiteSpace: "nowrap",
  },
  ok: { color: color.ok },
  warn: { color: color.warn },
  gone: { color: color.gone },
});

const tones = new Map([
  ["berlaku", styles.ok],
  ["diubah", styles.warn],
  ["dicabut", styles.gone],
  ["tidak_berlaku", styles.gone],
  ["official", styles.ok],
  ["archive", styles.warn],
  ["media", styles.warn],
  ["leak", styles.gone],
]);

/** A tone is a status or provenance key from the data; one not listed gets the quiet tone. */
export const Badge = (props: ParentProps<{ tone: string }>) => (
  <span class={css(styles.badge, tones.get(props.tone) ?? styles.gone)}>
    {props.children}
  </span>
);
