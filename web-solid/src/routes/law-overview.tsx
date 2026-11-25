import * as stylex from "@stylexjs/stylex";
import { createMemo, For, Show } from "solid-js";

import { LawRows } from "../components/law-rows.tsx";
import { useNoindex, usePageDescription, usePageTitle } from "../lib/head.ts";
import { slashed } from "../lib/paths.ts";
import { overviewQuery } from "../lib/queries.ts";
import { Router } from "../router.tsx";
import { css } from "../styles/css.ts";
import { linkClass } from "../styles/link.ts";
import { color, size, space } from "../styles/tokens.stylex.ts";

const styles = stylex.create({
  lead: {
    color: color.textMuted,
    fontSize: size.lg,
    maxWidth: size.measure,
  },
  years: {
    gap: space.s5,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(9rem, 1fr))",
  },
  decade: { fontSize: size.sm },
  decadeTitle: {
    marginBlock: `0 ${space.s2}`,
    color: color.textMuted,
    fontSize: size.sm,
  },
  yearList: { margin: 0, padding: 0, listStyle: "none" },
  yearItem: {
    display: "flex",
    justifyContent: "space-between",
    maxWidth: "7rem",
  },
  count: { color: color.textMuted },
});

const LawOverview = () => {
  usePageTitle(() => "Undang-Undang");
  usePageDescription(
    "Semua undang-undang Republik Indonesia sebagai teks yang bersih dan mudah dibaca."
  );
  useNoindex();
  const overview = createMemo(async () => await overviewQuery());

  return (
    <main>
      <h1>Undang-Undang</h1>
      <p class={css(styles.lead)}>
        {overview().total.toLocaleString("id-ID")} undang-undang dari{" "}
        <For each={overview().sources}>
          {(source, index) => (
            <>
              <Show when={index() > 0}>{" dan "}</Show>
              <a class={linkClass} href={`https://${source.host}`}>
                {source.name}
              </a>
            </>
          )}
        </For>
        , {overview().withText.toLocaleString("id-ID")} di antaranya sudah
        tersedia sebagai teks. Sisanya berupa PDF hasil pindaian yang masih
        menunggu OCR.
      </p>
      <h2>Menurut tahun</h2>
      <div class={css(styles.years)}>
        <For each={overview().decades}>
          {(decade) => (
            <div class={css(styles.decade)}>
              <h3 class={css(styles.decadeTitle)}>{decade.decade}-an</h3>
              <ul class={css(styles.yearList)}>
                <For each={decade.years}>
                  {({ year, count }) => (
                    <li class={css(styles.yearItem)}>
                      <a
                        class={linkClass}
                        href={slashed(Router.paths.uu.tahun(year))}
                      >
                        {year}
                      </a>{" "}
                      <span class={css(styles.count)}>{count}</span>
                    </li>
                  )}
                </For>
              </ul>
            </div>
          )}
        </For>
      </div>
      <h2>Terbaru</h2>
      <LawRows laws={overview().recent} />
    </main>
  );
};

export default LawOverview;
