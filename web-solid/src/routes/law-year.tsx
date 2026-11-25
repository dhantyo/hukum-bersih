import type { RouteProps } from "@solidjs/router";
import * as stylex from "@stylexjs/stylex";
import { createMemo, Show } from "solid-js";

import { LawRows } from "../components/law-rows.tsx";
import { usePageTitle } from "../lib/head.ts";
import { slashed } from "../lib/paths.ts";
import { yearQuery } from "../lib/queries.ts";
import { Router } from "../router.tsx";
import { css } from "../styles/css.ts";
import { linkStyles } from "../styles/link.ts";
import { color, size, space } from "../styles/tokens.stylex.ts";
import { touch } from "../styles/touch.ts";
import NotFound from "./not-found.tsx";

const styles = stylex.create({
  crumbs: {
    color: color.textMuted,
    fontSize: size.sm,
  },
  crumbLink: { color: color.textMuted },
  separator: { marginInline: space.s2 },
  muted: { color: color.textMuted },
});

const LawYear = (props: RouteProps<"/uu/tahun/:tahun">) => {
  const listing = createMemo(async () => await yearQuery(props.params.tahun));

  return (
    <Show when={listing()} fallback={<NotFound />} keyed>
      {(items) => {
        usePageTitle(() => `Undang-Undang tahun ${items.year}`);

        return (
          <main>
            <nav class={css(styles.crumbs)} aria-label="Lokasi">
              <a
                class={css(styles.crumbLink, linkStyles.base, touch.link)}
                href={slashed(Router.paths.uu)}
              >
                Undang-Undang
              </a>
              <span class={css(styles.separator)} aria-hidden="true">
                ›
              </span>
              <span>{items.year}</span>
            </nav>
            <h1>Undang-Undang tahun {items.year}</h1>
            <p class={css(styles.muted)}>
              {items.rows.length} undang-undang, terbaru di atas.
            </p>
            <LawRows laws={items.rows} />
          </main>
        );
      }}
    </Show>
  );
};

export default LawYear;
