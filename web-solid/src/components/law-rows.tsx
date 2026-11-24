import * as stylex from "@stylexjs/stylex";
import { For, Show } from "solid-js";

import { isPresent } from "../lib/text.ts";
import type { LawRow } from "../server/records/listings.ts";
import { css } from "../styles/css.ts";
import { color, size, space } from "../styles/tokens.stylex.ts";
import { Badge } from "./badge.tsx";

export const rowStyles = stylex.create({
  list: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    borderBlockStartColor: color.line,
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: 1,
  },
  row: {
    paddingBlock: space.s4,
    borderBlockEndColor: color.line,
    borderBlockEndStyle: "solid",
    borderBlockEndWidth: 1,
  },
  title: { fontWeight: 600 },
  meta: {
    color: color.textMuted,
    fontSize: size.sm,
    marginBlockStart: space.s1,
  },
});

export const LawRows = (props: { laws: LawRow[] }) => (
  <ul class={css(rowStyles.list)}>
    <For each={props.laws}>
      {(law) => (
        <li class={css(rowStyles.row)}>
          <a class={css(rowStyles.title)} href={law.u}>
            {law.title}
          </a>
          <div class={css(rowStyles.meta)}>
            <Show when={isPresent(law.short)} fallback={law.cite}>
              <strong>{law.short}</strong> · {law.cite}
            </Show>
            <Show when={law.status} keyed>
              {(status) => (
                <>
                  {" · "}
                  <Badge tone={status.key}>{status.label}</Badge>
                </>
              )}
            </Show>
            <Show when={isPresent(law.date)}>
              {" · ditetapkan "}
              {law.date}
            </Show>
            <Show when={law.changed > 0}>
              {" · "}
              <Badge tone="diubah">diubah {law.changed}×</Badge>
            </Show>
            <Show when={law.amends.length > 0}>
              {" · mengubah "}
              {law.amends.join(", ")}
            </Show>
            <Show when={!law.hasText}>
              {" · "}
              <Badge tone="none">teks belum tersedia</Badge>
            </Show>
          </div>
        </li>
      )}
    </For>
  </ul>
);
