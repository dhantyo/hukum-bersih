import * as stylex from "@stylexjs/stylex";
import { For } from "solid-js";

import type { ComparisonRecord } from "./amendment-record";

const styles = stylex.create({
  wording: {
    fontFamily: "var(--font-source-serif)",
    overflowWrap: "anywhere",
    whiteSpace: "pre-wrap",
  },
});

export type Amendment = ComparisonRecord["amendments"][number];

type Change = Amendment["changes"][number];

const changeLabels = {
  diubah: "Diubah",
  disisipkan: "Disisipkan",
  dihapus: "Dihapus",
};

export function ArticleChange(props: { change: Change }) {
  return (
    <section id={props.change.anchor} data-pagefind-ignore>
      <h3>
        Pasal {props.change.num} · {changeLabels[props.change.kind]}
      </h3>
      <h4>Sebelum</h4>
      <p class={stylex.props(styles.wording).className}>
        {props.change.before ??
          (props.change.missingBefore
            ? "Teks sebelumnya belum tersedia."
            : "Belum ada pasal ini.")}
      </p>
      <h4>Sesudah</h4>
      <p class={stylex.props(styles.wording).className}>
        {props.change.after ??
          (props.change.missingAfter
            ? "Teks baru belum tersedia."
            : "Pasal dihapus.")}
      </p>
    </section>
  );
}

function AmendmentEntry(props: { amendment: Amendment }) {
  return (
    <section id={props.amendment.id}>
      <h2>
        {props.amendment.href ? (
          <a href={props.amendment.href}>{props.amendment.label}</a>
        ) : (
          props.amendment.label
        )}
      </h2>
      {props.amendment.date && (
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
}

export function AmendmentComparison(props: { comparison: ComparisonRecord }) {
  return (
    <main class="law-reader">
      <a href="../">Kembali ke undang-undang</a>
      <h1>Perubahan {props.comparison.shortName ?? props.comparison.title}</h1>
      <For each={props.comparison.amendments}>
        {(amendment) => <AmendmentEntry amendment={amendment} />}
      </For>
    </main>
  );
}
