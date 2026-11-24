import * as stylex from "@stylexjs/stylex";
import { createMemo, For, Show } from "solid-js";

import { LawRows, rowStyles } from "../components/law-rows.tsx";
import { usePageDescription } from "../lib/head.ts";
import { draftChangesUrl, slashed } from "../lib/paths.ts";
import { draftBillsQuery, overviewQuery } from "../lib/queries.ts";
import { Router } from "../router.tsx";
import { css } from "../styles/css.ts";
import { color, size, space } from "../styles/tokens.stylex.ts";
import { accessibility } from "../styles/visually-hidden.ts";

const LATEST_LAWS = 6;
const PHONE = "@media (max-width: 800px)";

const styles = stylex.create({
  hero: {
    paddingBlockEnd: space.s6,
    paddingBlockStart: { [PHONE]: space.s6, default: space.s8 },
    maxWidth: "46rem",
  },
  title: { fontSize: size.xxl, marginBlockEnd: space.s4 },
  lead: { color: color.textMuted, fontSize: size.lg },
  search: {
    gap: space.s2,
    marginBlock: `${space.s5} ${space.s3}`,
    display: "flex",
  },
  field: {
    font: "inherit",
    borderColor: color.text,
    borderRadius: size.radius,
    borderStyle: "solid",
    borderWidth: 2,
    paddingBlock: space.s3,
    paddingInline: space.s4,
    backgroundColor: color.background,
    color: color.text,
    flexGrow: 1,
    fontSize: size.lg,
    minWidth: 0,
  },
  submit: {
    font: "inherit",
    borderColor: color.link,
    borderRadius: size.radius,
    borderStyle: "solid",
    borderWidth: 1,
    paddingBlock: space.s3,
    paddingInline: { [PHONE]: space.s3, default: space.s4 },
    backgroundColor: color.link,
    color: color.background,
    cursor: "pointer",
    fontSize: size.sm,
    fontWeight: 600,
  },
  stats: { color: color.textMuted, fontSize: size.sm },
  columns: {
    gap: { [PHONE]: 0, default: space.s7 },
    display: "grid",
    gridTemplateColumns: { [PHONE]: "1fr", default: "1fr 1fr" },
  },
  small: { fontSize: size.sm },
});

const Home = () => {
  usePageDescription(
    "Teks hukum Indonesia yang bersih dan mudah dibaca, serta pelacakan RUU beserta setiap versi drafnya."
  );
  const overview = createMemo(async () => await overviewQuery());
  const drafts = createMemo(async () => await draftBillsQuery());

  return (
    <main>
      <section class={css(styles.hero)}>
        <h1 class={css(styles.title)}>Hukum Indonesia, mudah dibaca.</h1>
        <p class={css(styles.lead)}>
          Teks undang-undang yang bersih dan bisa dicari, serta rancangan
          undang-undang beserta setiap versinya: dari mana asalnya, dan apa yang
          berubah.
        </p>
        <form
          class={css(styles.search)}
          action={slashed(Router.paths.cari)}
          method="get"
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- keeps the form markup the Astro site serves
          role="search"
        >
          <label class={css(accessibility.visuallyHidden)} for="hero-q">
            Cari
          </label>
          <input
            class={css(styles.field)}
            id="hero-q"
            name="q"
            type="search"
            placeholder="Contoh: perampasan aset, pasal 27 ITE, perkawinan…"
          />
          <button class={css(styles.submit)} type="submit">
            Cari
          </button>
        </form>
        <p class={css(styles.stats)}>
          <a href={slashed(Router.paths.uu)}>
            {overview().total.toLocaleString("id-ID")} undang-undang
          </a>{" "}
          ({overview().withText.toLocaleString("id-ID")} sebagai teks) ·{" "}
          <a href={slashed(Router.paths.ruu)}>{drafts().length} RUU dilacak</a>
        </p>
      </section>

      <div class={css(styles.columns)}>
        <section>
          <h2>RUU yang dilacak</h2>
          <ul class={css(rowStyles.list)}>
            <For each={drafts()}>
              {(draft) => (
                <li class={css(rowStyles.row)}>
                  <a
                    class={css(rowStyles.title)}
                    href={slashed(Router.paths.ruu(draft.slug))}
                  >
                    {draft.name}
                  </a>
                  <div class={css(rowStyles.meta)}>
                    <Show when={draft.last} keyed>
                      {(last) => (
                        <>{`Tahap terakhir: ${last.note ?? last.stage} (${last.date})`}</>
                      )}
                    </Show>
                    <Show when={draft.changes} keyed>
                      {(changes) => (
                        <>
                          {" · "}
                          <a href={draftChangesUrl(draft.slug, changes)}>
                            lihat apa yang berubah
                          </a>
                        </>
                      )}
                    </Show>
                  </div>
                </li>
              )}
            </For>
          </ul>
        </section>
        <section>
          <h2>Undang-undang terbaru</h2>
          <LawRows laws={overview().recent.slice(0, LATEST_LAWS)} />
          <p class={css(styles.small)}>
            <a href={slashed(Router.paths.uu)}>Semua undang-undang →</a>
          </p>
        </section>
      </div>
    </main>
  );
};

export default Home;
