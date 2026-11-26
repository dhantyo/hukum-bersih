import { Meta } from "@solidjs/meta";
import * as stylex from "@stylexjs/stylex";
import { createMemo, For, Show } from "solid-js";

import { PageTitle } from "../components/page-title.tsx";
import { slashed } from "../lib/paths.ts";
import { draftBillsQuery } from "../lib/queries.ts";
import { Router } from "../router.tsx";
import { css } from "../styles/css.ts";
import { linkClass } from "../styles/link.ts";
import { color, size, space } from "../styles/tokens.stylex.ts";

const styles = stylex.create({
  muted: { color: color.textMuted },
  list: { margin: 0, padding: 0, listStyle: "none" },
  card: {
    borderColor: color.line,
    borderRadius: size.radiusMd,
    borderStyle: "solid",
    borderWidth: 1,
    marginBlock: space.s3,
    paddingBlock: space.s4,
    paddingInline: space.s5,
    backgroundColor: color.backgroundSubtle,
  },
  small: { fontSize: size.sm },
  meta: { color: color.textMuted, fontSize: size.sm },
});

const DraftIndex = () => {
  const bills = createMemo(async () => await draftBillsQuery());

  return (
    <main>
      <PageTitle>RUU</PageTitle>
      <Meta
        name="description"
        content="Rancangan undang-undang yang dilacak beserta versi-versinya."
      />
      <h1>Rancangan Undang-Undang</h1>
      <p class={css(styles.muted)}>
        Setiap RUU dilacak beserta semua versi draf yang pernah muncul dan
        asal-usulnya.
      </p>
      <ul class={css(styles.list)}>
        <For each={bills()}>
          {(bill) => (
            <li class={css(styles.card)}>
              <a class={linkClass} href={slashed(Router.paths.ruu(bill.slug))}>
                <strong>{bill.name}</strong>
              </a>
              <div class={css(styles.small)}>{bill.title}</div>
              <div class={css(styles.meta)}>
                {bill.versions} versi teks
                <Show when={bill.last} keyed>
                  {(last) => (
                    <>{` · tahap terakhir: ${last.date}${last.note === null ? "" : ` (${last.note})`}`}</>
                  )}
                </Show>
              </div>
            </li>
          )}
        </For>
      </ul>
    </main>
  );
};

export default DraftIndex;
