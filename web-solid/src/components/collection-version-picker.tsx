import * as stylex from "@stylexjs/stylex";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@ui-sdk/solid/select";
import { For } from "solid-js";

import { tanggal } from "../../../web/src/lib/labels.ts";
import type { VersionChoice } from "../lib/collection-compare.ts";
import { isPresent } from "../lib/text.ts";
import { css } from "../styles/css.ts";
import { color, space } from "../styles/tokens.stylex.ts";

const styles = stylex.create({
  select: { gap: space.s1, display: "grid" },
  trigger: {
    font: "inherit",
    borderColor: color.lineStrong,
    borderRadius: 4,
    borderStyle: "solid",
    borderWidth: 1,
    paddingInline: space.s3,
    backgroundColor: color.background,
    color: color.text,
    textAlign: "start",
    minHeight: "2.75rem",
  },
  content: {
    padding: space.s1,
    borderColor: color.lineStrong,
    borderRadius: 4,
    borderStyle: "solid",
    borderWidth: 1,
    marginBlock: space.s1,
    backgroundColor: color.background,
    maxWidth: "20rem",
  },
  item: {
    borderRadius: 4,
    paddingBlock: space.s1,
    paddingInline: space.s2,
    backgroundColor: {
      default: null,
      ":is([data-highlighted])": color.linkBackground,
    },
    cursor: "pointer",
  },
});

/** The version a picker shows for one version: its name and, when known, its date. */
export const versionName = (version: VersionChoice) =>
  isPresent(version.date)
    ? `${version.label} · ${tanggal(version.date)}`
    : version.label;

/**
 * One version picker. It is a ui-sdk Select named like the search parameter it fills, so a
 * GET form submits the choice (`dari`, `bandingkan`).
 */
export const VersionPicker = (props: {
  name: string;
  label: string;
  versions: VersionChoice[];
  value: string;
}) => (
  <div class={css(styles.select)}>
    <Select
      name={props.name}
      defaultValue={props.value}
      items={props.versions.map((version) => ({
        value: version.id,
        label: versionName(version),
      }))}
    >
      <SelectLabel>{props.label}</SelectLabel>
      <SelectTrigger class={css(styles.trigger)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent class={css(styles.content)}>
        <For each={props.versions}>
          {(version) => (
            <SelectItem value={version.id} class={css(styles.item)}>
              {versionName(version)}
            </SelectItem>
          )}
        </For>
      </SelectContent>
    </Select>
  </div>
);
