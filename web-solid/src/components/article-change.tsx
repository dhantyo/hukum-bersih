import * as stylex from "@stylexjs/stylex";

import type { Amendment } from "../server/records/law.ts";
import { css } from "../styles/css.ts";

const styles = stylex.create({
  wording: {
    fontFamily: "var(--font-source-serif)",
    overflowWrap: "anywhere",
    whiteSpace: "pre-wrap",
  },
});

const changeLabels = {
  diubah: "Diubah",
  disisipkan: "Disisipkan",
  dihapus: "Dihapus",
};

export const ArticleChange = (props: {
  change: Amendment["changes"][number];
}) => (
  <section id={props.change.anchor} data-pagefind-ignore>
    <h3>
      Pasal {props.change.num} · {changeLabels[props.change.kind]}
    </h3>
    <h4>Sebelum</h4>
    <p class={css(styles.wording)}>
      {props.change.before ??
        (props.change.missingBefore
          ? "Teks sebelumnya belum tersedia."
          : "Belum ada pasal ini.")}
    </p>
    <h4>Sesudah</h4>
    <p class={css(styles.wording)}>
      {props.change.after ??
        (props.change.missingAfter
          ? "Teks baru belum tersedia."
          : "Pasal dihapus.")}
    </p>
  </section>
);
