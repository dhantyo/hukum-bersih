import { revalidate } from "@solidjs/router";
import * as stylex from "@stylexjs/stylex";
import { Show } from "solid-js";

import type { Comparison } from "../lib/compare.ts";
import { collectionComparisonQuery } from "../lib/queries.ts";
import { css } from "../styles/css.ts";
import { color, size, space } from "../styles/tokens.stylex.ts";

const styles = stylex.create({
  failure: {
    padding: `${space.s2} ${space.s3}`,
    borderColor: color.warn,
    borderRadius: size.radiusMd,
    borderStyle: "solid",
    borderWidth: 1,
    gap: space.s3,
    alignItems: "center",
    display: "flex",
    flexWrap: "wrap",
    fontSize: size.sm,
    marginBlockEnd: space.s3,
    maxInlineSize: size.measure,
  },
  retry: {
    font: "inherit",
    borderColor: color.lineStrong,
    borderRadius: size.radius,
    borderStyle: "solid",
    borderWidth: 1,
    paddingBlock: space.s1,
    paddingInline: space.s3,
    backgroundColor: color.background,
    color: color.link,
    cursor: "pointer",
  },
});

/** Shown when the browser could not load the versions the address asks for: the comparison
 * above it is the one from before. */
export const ComparisonFailure = (props: { comparison: Comparison }) => (
  <Show when={props.comparison.failed === true}>
    <output class={css(styles.failure)}>
      Versi yang dipilih tidak bisa dimuat. Yang tampil masih perbandingan
      sebelumnya.
      <button
        type="button"
        class={css(styles.retry)}
        onClick={() => {
          revalidate(collectionComparisonQuery.key);
        }}
      >
        Coba lagi
      </button>
    </output>
  </Show>
);
