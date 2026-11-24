import { Checkbox, CheckboxIndicator } from "@ui-sdk/solid/checkbox";

import { css } from "../styles/css.ts";
import { synopsisStyles as styles } from "../styles/synopsis.ts";

export const SameRowsToggle = (props: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <label class={css(styles.toggle)}>
    <Checkbox
      class={css(styles.checkbox)}
      checked={props.checked}
      onCheckedChange={(next) => {
        props.onChange(next === true);
      }}
    >
      <CheckboxIndicator aria-hidden="true">✓</CheckboxIndicator>
    </Checkbox>
    Tampilkan juga pasal yang isi dan nomornya tidak berubah
  </label>
);
