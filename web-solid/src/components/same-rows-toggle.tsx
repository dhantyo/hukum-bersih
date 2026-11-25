import * as stylex from "@stylexjs/stylex";

import { css } from "../styles/css.ts";
import { color, space } from "../styles/tokens.stylex.ts";

const styles = stylex.create({
  label: {
    cursor: "pointer",
    display: "block",
    marginBlockStart: space.s3,
  },
  box: { margin: 0, accentColor: color.link },
});

/**
 * Shows the pasal whose text and number did not change. A plain checkbox, not a ui-sdk one:
 * the browser keeps its state, and the rows below react to it in CSS (`data-show-same` in
 * `styles/synopsis.ts`), so it works before the page's script has run and without it.
 */
export const SameRowsToggle = (props: { label: string }) => (
  <label class={css(styles.label)}>
    <input type="checkbox" data-show-same class={css(styles.box)} />
    {props.label}
  </label>
);
