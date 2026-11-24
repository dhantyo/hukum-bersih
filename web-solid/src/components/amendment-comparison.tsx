import { For } from "solid-js";

import type { Amendment, Comparison } from "../server/records/law.ts";
import { readerClass } from "../styles/reading.ts";
import { ArticleChange } from "./article-change.tsx";

const AmendmentEntry = (props: { amendment: Amendment }) => (
  <section id={props.amendment.id}>
    <h2>
      {props.amendment.href === undefined ? (
        props.amendment.label
      ) : (
        <a href={props.amendment.href}>{props.amendment.label}</a>
      )}
    </h2>
    {props.amendment.date !== null && (
      <time datetime={props.amendment.date}>{props.amendment.date}</time>
    )}
    {props.amendment.gap > 0 && (
      <p>Sebagian perubahan sebelumnya belum tersedia.</p>
    )}
    <For each={props.amendment.instructions}>
      {(instruction) => <p>{instruction}</p>}
    </For>
    <For each={props.amendment.changes}>
      {(change) => <ArticleChange change={change} />}
    </For>
  </section>
);

export const AmendmentComparison = (props: { comparison: Comparison }) => (
  <main class={readerClass}>
    <a href="../">Kembali ke undang-undang</a>
    <h1>Perubahan {props.comparison.shortName ?? props.comparison.title}</h1>
    <For each={props.comparison.amendments}>
      {(amendment) => <AmendmentEntry amendment={amendment} />}
    </For>
  </main>
);
