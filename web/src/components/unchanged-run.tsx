import * as stylex from "@stylexjs/stylex";
import { For, Show } from "solid-js";

import { runName } from "../lib/compare-span.ts";
import type { UnchangedPasal } from "../lib/compare-span.ts";
import { css } from "../styles/css.ts";
import { reading } from "../styles/reading.ts";
import { color, font, size, space } from "../styles/tokens.stylex.ts";
import { PasalText } from "./law-text.tsx";

const ONLY_CHANGED = ":has([data-cmp-only]:checked)";

const styles = stylex.create({
  run: {
    borderColor: color.line,
    borderRadius: size.radiusMd,
    borderStyle: "solid",
    borderWidth: 1,
    marginBlock: space.s3,
    backgroundColor: color.backgroundSubtle,
    display: {
      default: "block",
      [stylex.when.ancestor(ONLY_CHANGED)]: "none",
    },
  },
  summary: {
    padding: `${space.s2} ${space.s3}`,
    gap: `${space.s1} ${space.s3}`,
    alignItems: "center",
    color: color.textMuted,
    cursor: "pointer",
    display: "flex",
    flexWrap: "wrap",
    fontFamily: font.ui,
    fontSize: size.sm,
  },
  sign: {
    borderColor: color.lineStrong,
    borderRadius: 999,
    borderStyle: "solid",
    borderWidth: 1,
    alignItems: "center",
    blockSize: "1.25rem",
    display: "inline-flex",
    fontWeight: 600,
    inlineSize: "1.25rem",
    justifyContent: "center",
    lineHeight: 1,
  },
  name: { color: color.text },
  body: {
    paddingBlock: space.s2,
    paddingInline: space.s3,
    borderBlockStartColor: color.line,
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: 1,
    maxInlineSize: size.measure,
  },
  pasal: {
    containIntrinsicSize: "auto 8rem",
    contentVisibility: "auto",
  },
  title: { marginBlock: `${space.s3} ${space.s1}`, fontSize: size.base },
});

/**
 * Neighbouring pasal that read the same in every column, as one quiet row that says so and opens
 * to the text, shown once. A native `<details>`, so it works without a script and find-in-page
 * opens it. The "Yang berubah saja" box of the bar hides it.
 */
export const UnchangedRun = (props: { pasal: UnchangedPasal[] }) => (
  <details class={css(styles.run)} data-cmp-same>
    <summary class={css(styles.summary)}>
      <span class={css(styles.sign)} aria-hidden="true">
        =
      </span>
      <strong class={css(styles.name)}>{runName(props.pasal)}</strong>
      <span>tidak berubah, sama di semua versi</span>
      <Show when={props.pasal.length > 1}>
        <span>({props.pasal.length} pasal)</span>
      </Show>
    </summary>
    <div class={css(reading.law, styles.body)}>
      <For each={props.pasal}>
        {(pasal) => (
          <section
            id={`pasal-${pasal.key}`}
            class={css(styles.pasal)}
            aria-label={`Pasal ${pasal.num}, tidak berubah`}
          >
            <h4 class={css(styles.title)}>Pasal {pasal.num}</h4>
            <PasalText node={pasal.node} />
          </section>
        )}
      </For>
    </div>
  </details>
);
