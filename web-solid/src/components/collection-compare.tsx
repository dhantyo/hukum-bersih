import * as stylex from "@stylexjs/stylex";
import { For } from "solid-js";

import type {
  ChangedLine,
  ChangedPasal,
  ChangedStatus,
  CollectionCompareView,
} from "../lib/collection-compare.ts";
import { pasalKey } from "../lib/display.ts";
import { css } from "../styles/css.ts";
import { linkClass } from "../styles/link.ts";
import { color, font, space } from "../styles/tokens.stylex.ts";
import { VersionPicker, versionName } from "./collection-version-picker.tsx";

const styles = stylex.create({
  bar: {
    gap: space.s3,
    alignItems: "end",
    display: "flex",
    flexWrap: "wrap",
  },
  note: {
    padding: space.s2,
    borderColor: color.warn,
    borderRadius: 4,
    borderStyle: "solid",
    borderWidth: 1,
  },
  pasal: {
    paddingBlock: space.s3,
    borderBottomColor: color.line,
    borderBottomStyle: "solid",
    borderBottomWidth: 1,
  },
  status: { color: color.textMuted, fontWeight: "normal" },
  line: {
    gap: space.s1,
    marginBlock: space.s2,
    display: "grid",
    fontFamily: font.sourceSerif,
    gridTemplateColumns: "minmax(2rem, max-content) minmax(0, 1fr)",
  },
  indent1: { marginInlineStart: "2rem" },
  indent2: { marginInlineStart: "4rem" },
  indent3: { marginInlineStart: "6rem" },
  inserted: {
    textDecoration: "none",
    backgroundColor: color.insBackground,
    color: color.insText,
  },
  deleted: {
    backgroundColor: color.delBackground,
    color: color.delText,
  },
  muted: { color: color.textMuted },
});

const statusText: Record<ChangedStatus, string> = {
  berubah: "diubah",
  baru: "pasal baru",
  dihapus: "dihapus",
  "belum-ada": "belum ada di versi ini",
  "belum-terbaca": "teks belum terbaca dari PDF",
};

const indents = [undefined, styles.indent1, styles.indent2, styles.indent3];

const Line = (props: { line: ChangedLine }) => (
  <p class={css(styles.line, indents[Math.min(props.line.indent, 3)])}>
    <span>{props.line.num}</span>
    <span>
      <For each={props.line.parts}>
        {(part) => {
          if (part.added) {
            return <ins class={css(styles.inserted)}>{part.value}</ins>;
          }

          return part.removed ? (
            <del class={css(styles.deleted)}>{part.value}</del>
          ) : (
            part.value
          );
        }}
      </For>
    </span>
  </p>
);

const ChangedArticle = (props: { pasal: ChangedPasal }) => (
  <article
    id={`banding-${pasalKey(props.pasal.num)}`}
    class={css(styles.pasal)}
  >
    <h3>
      Pasal {props.pasal.num}{" "}
      <span class={css(styles.status)}>· {statusText[props.pasal.status]}</span>
    </h3>
    {props.pasal.previousUnreadable && (
      <p class={css(styles.muted)}>
        Teks versi pertama belum terbaca dari PDF.
      </p>
    )}
    <For each={props.pasal.lines}>{(line) => <Line line={line} />}</For>
  </article>
);

const Result = (props: { comparison: CollectionCompareView }) => {
  const named = (id: string) => {
    const version = props.comparison.versions.find((entry) => entry.id === id);

    return version === undefined ? id : versionName(version);
  };

  return (
    <>
      {props.comparison.selected === null ? null : (
        <p aria-live="polite">
          {props.comparison.changed.length} pasal berbeda antara{" "}
          {named(props.comparison.selected.from)} dan{" "}
          {named(props.comparison.selected.to)}.
        </p>
      )}
      {props.comparison.gap > 0 && (
        <p class={css(styles.note)}>
          Ada {props.comparison.gap} perubahan di antara versi-versi ini yang
          belum tercatat (biasanya melalui UU Cipta Kerja); pasal yang diubah
          olehnya tidak tampak di sini.
        </p>
      )}
      <For each={props.comparison.changed}>
        {(pasal) => <ChangedArticle pasal={pasal} />}
      </For>
    </>
  );
};

const pairLink = (from: string, to: string) =>
  `?dari=${from}&bandingkan=${to}#banding`;

/**
 * Compare two versions of a collection: pick them (a ui-sdk Select each, submitted by a GET
 * form) or follow a quick link; the pasal that differ are rendered by the server.
 */
export const CollectionCompare = (props: {
  comparison: CollectionCompareView;
}) => {
  const ids = () => props.comparison.versions.map((version) => version.id);
  const first = () => ids()[0];
  const last = () => ids().at(-1) ?? first();
  const before = () => ids().at(-2) ?? first();

  return (
    <section id="banding" aria-labelledby="banding-title">
      <h2 id="banding-title">Bandingkan versi</h2>
      <p>
        Pilih dua versi, lalu lihat pasal yang berubah di antara keduanya. Yang{" "}
        <ins class={css(styles.inserted)}>baru</ins> dan yang{" "}
        <del class={css(styles.deleted)}>dihapus</del> ditandai dibanding versi
        pertama.
      </p>
      <form method="get" action="#banding" class={css(styles.bar)}>
        <VersionPicker
          name="dari"
          label="Versi pertama"
          versions={props.comparison.versions}
          value={props.comparison.selected?.from ?? first()}
        />
        <VersionPicker
          name="bandingkan"
          label="Versi kedua"
          versions={props.comparison.versions}
          value={props.comparison.selected?.to ?? last()}
        />
        <button type="submit">Bandingkan</button>
      </form>
      <p>
        Cepat:{" "}
        <a class={linkClass} href={pairLink(first(), last())}>
          Asli dan terbaru
        </a>{" "}
        ·{" "}
        <a class={linkClass} href={pairLink(before(), last())}>
          Perubahan terakhir
        </a>
      </p>
      {props.comparison.unknown && (
        <output>Versi yang diminta tidak dikenal di koleksi ini.</output>
      )}
      <Result comparison={props.comparison} />
    </section>
  );
};
