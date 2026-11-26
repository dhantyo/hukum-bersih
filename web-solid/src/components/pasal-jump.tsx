import * as stylex from "@stylexjs/stylex";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from "@ui-sdk/solid/combobox";
import type { ListAnnouncement, ListItem } from "@ui-sdk/solid/combobox";
import { createSignal, For } from "solid-js";

import { pasalStartsWith } from "../lib/pasal-match.ts";
import { css } from "../styles/css.ts";
import { color, size, space } from "../styles/tokens.stylex.ts";

const styles = stylex.create({
  field: {
    gap: `${space.s1} ${space.s2}`,
    alignItems: "center",
    color: color.textMuted,
    display: "flex",
    flexWrap: "wrap",
    fontSize: size.xs,
    marginBlockEnd: space.s3,
  },
  input: {
    font: "inherit",
    borderColor: color.lineStrong,
    borderRadius: size.radius,
    borderStyle: "solid",
    borderWidth: 1,
    paddingBlock: space.s1,
    paddingInline: space.s2,
    backgroundColor: color.background,
    color: color.text,
    fontSize: size.sm,
    inlineSize: "5rem",
  },
  content: {
    padding: space.s1,
    borderColor: color.lineStrong,
    borderRadius: size.radius,
    borderStyle: "solid",
    borderWidth: 1,
    backgroundColor: color.background,
    color: color.text,
    fontSize: size.sm,
    maxBlockSize: "min(var(--available-height), 18rem)",
    minInlineSize: "8rem",
    overflowY: "auto",
  },
  item: {
    borderRadius: size.radius,
    paddingBlock: space.s1,
    paddingInline: space.s2,
    backgroundColor: {
      default: null,
      ":is([data-highlighted])": color.linkBackground,
    },
    cursor: "pointer",
  },
  empty: { padding: space.s2, color: color.warn },
});

const startsLikeTyped = (item: ListItem, query: string) =>
  pasalStartsWith(item.label, query);

const announce = (change: ListAnnouncement) => {
  if (change.type !== "results") {
    return null;
  }

  return change.count === 0 ? "Pasal tidak ada" : `${change.count} pasal`;
};

/** "Ke pasal": type a pasal number, pick it from the list, and the page moves to it. */
export const PasalJump = (props: {
  targets: readonly { num: string; href: string }[];
}) => {
  const [query, setQuery] = createSignal("");

  return (
    <Combobox
      filter={startsLikeTyped}
      autoHighlight
      value={null}
      query={query()}
      onQueryChange={(next, details) => {
        setQuery(details.reason === "item-press" ? "" : next);
      }}
      onValueChange={(next) => {
        if (next !== null) {
          location.hash = next;
        }
      }}
      announcement={announce}
    >
      <div class={css(styles.field)}>
        <ComboboxLabel>Ke pasal</ComboboxLabel>
        <ComboboxInput
          class={css(styles.input)}
          autocomplete="off"
          placeholder="mis. 27"
        />
      </div>
      <ComboboxContent class={css(styles.content)} align="start">
        <ComboboxEmpty class={css(styles.empty)}>Pasal tidak ada</ComboboxEmpty>
        <ComboboxList>
          <For each={props.targets}>
            {(target) => (
              <ComboboxItem
                class={css(styles.item)}
                value={target.href}
                label={target.num}
              >
                Pasal {target.num}
              </ComboboxItem>
            )}
          </For>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
};
