import * as stylex from "@stylexjs/stylex";
import { createMemo, For } from "solid-js";

import { usePageTitle } from "../lib/head.ts";
import { collectionsQuery } from "../lib/queries.ts";
import { css } from "../styles/css.ts";
import { linkStyles } from "../styles/link.ts";
import { color, size, space } from "../styles/tokens.stylex.ts";

const styles = stylex.create({
  lead: { maxInlineSize: size.measure },
  section: {
    margin: `${space.s6} 0 ${space.s3}`,
    fontSize: size.lg,
  },
  cards: {
    margin: 0,
    padding: 0,
    gap: space.s3,
    listStyle: "none",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(16rem, 1fr))",
  },
  card: {
    padding: space.s4,
    borderColor: { default: color.line, ":hover": color.link },
    borderRadius: size.radiusMd,
    borderStyle: "solid",
    borderWidth: 1,
    gap: space.s1,
    textDecoration: "none",
    backgroundColor: { default: null, ":hover": color.linkBackground },
    blockSize: "100%",
    boxSizing: "border-box",
    color: color.text,
    display: "grid",
  },
  name: { color: color.link, fontSize: size.md },
  cardTitle: { fontSize: size.sm },
  cardMeta: { color: color.textMuted, fontSize: size.xs },
  rows: {
    margin: 0,
    padding: 0,
    columns: "2 22rem",
    listStyle: "none",
    borderBlockStartColor: color.line,
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: 1,
  },
  row: {
    paddingBlock: space.s1,
    borderBlockEndColor: color.line,
    borderBlockEndStyle: "solid",
    borderBlockEndWidth: 1,
    breakInside: "avoid",
  },
  rowMeta: { color: color.textMuted, fontSize: size.sm },
});

const amendedText = (count: number) => `diubah ${count}×`;

const CollectionIndex = () => {
  usePageTitle(() => "Koleksi");
  const collections = createMemo(async () => await collectionsQuery());
  const named = () => collections().filter((collection) => collection.named);

  const other = () =>
    collections()
      .filter((collection) => !collection.named)
      .toSorted((first, second) => second.year - first.year);

  return (
    <main>
      <h1>Koleksi</h1>
      <p class={css(styles.lead)}>
        Satu koleksi berisi undang-undang pokok beserta semua undang-undang yang
        mengubahnya, dan undang-undang yang digantikannya.
      </p>
      <h2 class={css(styles.section)}>Dengan nama singkat</h2>
      <ul class={css(styles.cards)}>
        <For each={named()}>
          {(collection) => (
            <li>
              <a class={css(linkStyles.base, styles.card)} href={collection.u}>
                <strong class={css(styles.name)}>{collection.name}</strong>
                <span class={css(styles.cardTitle)}>{collection.t}</span>
                <span class={css(styles.cardMeta)}>
                  {collection.cite} · {collection.laws} undang-undang
                  {collection.k > 0 && ` · ${amendedText(collection.k)}`}
                </span>
              </a>
            </li>
          )}
        </For>
      </ul>
      <h2 class={css(styles.section)}>Undang-undang lain yang pernah diubah</h2>
      <ul class={css(styles.rows)}>
        <For each={other()}>
          {(collection) => (
            <li class={css(styles.row)}>
              <a class={css(linkStyles.base)} href={collection.u}>
                {collection.name}
              </a>{" "}
              <span class={css(styles.rowMeta)}>
                {collection.cite} · {amendedText(collection.k)}
              </span>
            </li>
          )}
        </For>
      </ul>
    </main>
  );
};

export default CollectionIndex;
