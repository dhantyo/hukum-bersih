import * as stylex from "@stylexjs/stylex";
import { Checkbox, CheckboxIndicator } from "@ui-sdk/solid/checkbox";

import { css } from "../styles/css.ts";
import { color, size, space } from "../styles/tokens.stylex.ts";

const styles = stylex.create({
  label: {
    gap: space.s2,
    alignItems: "center",
    cursor: "pointer",
    display: "flex",
    fontSize: size.sm,
    marginBlockStart: space.s3,
  },
  disabled: { color: color.textMuted, cursor: "default" },
  box: {
    padding: 0,
    borderColor: color.link,
    borderRadius: size.radius,
    borderStyle: "solid",
    borderWidth: 2,
    alignItems: "center",
    backgroundColor: {
      default: color.background,
      ":is([data-checked])": color.link,
    },
    color: color.background,
    cursor: "inherit",
    display: "inline-flex",
    flexShrink: 0,
    justifyContent: "center",
    height: "1.25rem",
    width: "1.25rem",
  },
});

/** A ui-sdk Checkbox named by the text beside it; a press on the text toggles it. */
export const LabelledCheckbox = (props: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <label class={css(styles.label, props.disabled === true && styles.disabled)}>
    <Checkbox
      class={css(styles.box)}
      checked={props.checked}
      disabled={props.disabled}
      onCheckedChange={(next) => {
        props.onChange(next === true);
      }}
    >
      <CheckboxIndicator aria-hidden="true">✓</CheckboxIndicator>
    </Checkbox>
    {props.label}
  </label>
);
