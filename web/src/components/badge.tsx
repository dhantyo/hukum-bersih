import * as stylex from "@stylexjs/stylex";
import { Show } from "solid-js";
import type { ParentProps } from "solid-js";

import { css } from "../styles/css.ts";
import { linkStyles } from "../styles/link.ts";
import { color, size, space } from "../styles/tokens.stylex.ts";

const styles = stylex.create({
  badge: {
    borderColor: "currentColor",
    borderRadius: 999,
    borderStyle: "solid",
    borderWidth: 1,
    paddingInline: space.s2,
    alignItems: "center",
    columnGap: space.s1,
    display: "inline-flex",
    fontSize: size.xs,
    fontWeight: 600,
    lineHeight: 1.6,
    verticalAlign: "0.1em",
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

/**
 * A status or provenance pill: coloured text and border, no fill. A tone not listed gets the quiet
 * tone; with an `href` the pill is a link.
 */
export const Badge = (props: ParentProps<{ tone: string; href?: string }>) => {
  const classes = () => [styles.badge, tones.get(props.tone) ?? styles.gone];

  return (
    <Show
      when={props.href}
      fallback={<span class={css(classes())}>{props.children}</span>}
    >
      {(href) => (
        <a class={css(linkStyles.base, classes())} href={href()}>
          {props.children}
        </a>
      )}
    </Show>
  );
};
