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

import type { VersionChoice } from "../lib/collection-compare.ts";
import { tanggal } from "../lib/labels.ts";
import { isPresent } from "../lib/text.ts";
import { css } from "../styles/css.ts";
import { color, size, space } from "../styles/tokens.stylex.ts";
import { accessibility } from "../styles/visually-hidden.ts";

const styles = stylex.create({
  trigger: {
    font: "inherit",
    borderRadius: size.radius,
    borderWidth: 0,
    gap: space.s1,
    paddingBlock: space.s1,
    paddingInline: space.s1,
    alignItems: "center",
    backgroundColor: "transparent",
    color: color.text,
    cursor: "pointer",
    display: "inline-flex",
    fontSize: size.base,
    fontWeight: 600,
    minBlockSize: space.s6,
    outlineColor: color.link,
    outlineOffset: 2,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: 3,
    textAlign: "start",
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
  onPick?: (id: string) => void;
}) => (
  <Select
    name={props.name}
    defaultValue={props.value}
    items={props.versions.map((version) => ({
      value: version.id,
      label: version.cite,
    }))}
    onValueChange={(id) => {
      if (id !== null && id !== props.value) {
        props.onPick?.(id);
      }
    }}
  >
    <SelectLabel class={css(accessibility.visuallyHidden)}>
      {props.label}
    </SelectLabel>
    <SelectTrigger class={css(styles.trigger)}>
      <SelectValue />
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path
          d="m4 6 4 4 4-4"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
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
);
