import * as stylex from "@stylexjs/stylex";
import { For, Show } from "solid-js";

import type {
  ChangedLine,
  ChangedPasal,
  ChangedStatus,
  CollectionCompareView,
} from "../lib/collection-compare.ts";
import { pasalKey } from "../lib/display.ts";
import { changes } from "../styles/changes.ts";
import { css } from "../styles/css.ts";
import { linkStyles } from "../styles/link.ts";
import { reading } from "../styles/reading.ts";
import { color, size, space } from "../styles/tokens.stylex.ts";
import { versionName } from "./collection-version-picker.tsx";
import { VersionPair } from "./version-pair.tsx";

const styles = stylex.create({
  bar: {
    padding: space.s3,
    borderColor: color.line,
    borderRadius: size.radiusMd,
    borderStyle: "solid",
    borderWidth: 1,
    marginBlock: space.s3,
    backgroundColor: color.backgroundSubtle,
  },
  presets: {
    gap: space.s2,
    marginBlock: space.s3,
    alignItems: "center",
    display: "flex",
    flexWrap: "wrap",
    fontSize: size.sm,
  },
  preset: {
    borderColor: {
      default: color.lineStrong,
      ":hover": color.link,
    },
    borderRadius: 999,
    borderStyle: "solid",
    borderWidth: 1,
    paddingBlock: "0.2rem",
    paddingInline: space.s3,
    textDecoration: "none",
    color: color.text,
  },
  top: {
    gap: space.s3,
    alignItems: "center",
    display: "flex",
    justifyContent: "space-between",
  },
  heading: { margin: 0 },
  close: {
    font: "inherit",
    borderColor: color.lineStrong,
    borderRadius: size.radius,
    borderStyle: "solid",
    borderWidth: 1,
    paddingBlock: space.s1,
    paddingInline: space.s3,
    textDecoration: "none",
    alignItems: "center",
    display: "inline-flex",
    minBlockSize: space.s6,
  },
  summary: { margin: 0, color: color.textMuted, fontSize: size.sm },
  note: {
    padding: `${space.s2} ${space.s3}`,
    borderColor: color.warn,
    borderRadius: size.radiusMd,
    borderStyle: "solid",
    borderWidth: 1,
    fontSize: size.sm,
    maxInlineSize: size.measure,
  },
  pasal: {
    paddingBlock: space.s3,
    borderBottomColor: color.line,
    borderBottomStyle: "solid",
    borderBottomWidth: 1,
  },
  title: { marginBlock: `0 ${space.s2}`, fontSize: size.base },
  status: { color: color.textMuted, fontWeight: "normal" },
  line: {
    marginBlock: `0 ${space.s2}`,
    columnGap: "0.3rem",
    display: "grid",
    gridTemplateColumns: `minmax(${size.hang}, max-content) minmax(0, 1fr)`,
    lineHeight: 1.6,
  },
  indent1: { marginInlineStart: size.hang },
  indent2: { marginInlineStart: `calc(2 * ${size.hang})` },
  indent3: { marginInlineStart: `calc(3 * ${size.hang})` },
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
  <p
    class={css(
      reading.law,
      styles.line,
      indents[Math.min(props.line.indent, 3)]
    )}
  >
    <span>{props.line.num}</span>
    <span>
      <For each={props.line.parts}>
        {(part) => {
          if (part.added) {
            return <ins class={css(changes.ins)}>{part.value}</ins>;
          }

          return part.removed ? (
            <del class={css(changes.del)}>{part.value}</del>
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
    <h3 class={css(styles.title)}>
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
        <p class={css(styles.summary)} aria-live="polite">
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

/** Where the "Bandingkan versi" button of the side panel leads: the first version against the latest. */
export const firstToLatestHref = (comparison: CollectionCompareView) =>
  pairLink(
    comparison.versions[0]?.id ?? "",
    comparison.versions.at(-1)?.id ?? ""
  );

/**
 * Compare two versions of a collection: the same pair of pickers as the law page (drag a
 * column across to swap, or pick another version), or follow a quick link; the pasal that
 * differ are rendered by the server.
 */
export const CollectionCompare = (props: {
  comparison: CollectionCompareView;
  onDemand?: boolean;
}) => {
  const ids = () => props.comparison.versions.map((version) => version.id);
  const first = () => ids()[0];
  const last = () => ids().at(-1) ?? first();
  const before = () => ids().at(-2) ?? first();

  const shown = () =>
    props.onDemand !== true ||
    props.comparison.selected !== null ||
    props.comparison.unknown;

  return (
    <Show when={shown()}>
      <section id="banding" aria-labelledby="banding-title">
        <div class={css(styles.top)}>
          <h2 id="banding-title" class={css(styles.heading)}>
            Bandingkan versi
          </h2>
          <Show when={props.onDemand}>
            <a
              class={css(linkStyles.base, styles.close)}
              href="./"
              target="_self"
            >
              Tutup
            </a>
          </Show>
        </div>
        <p>
          Pilih dua versi, lalu lihat pasal yang berubah di antara keduanya.
          Yang <ins class={css(changes.ins)}>baru</ins> dan yang{" "}
          <del class={css(changes.del)}>dihapus</del> ditandai dibanding versi
          pertama.
        </p>
        <div class={css(styles.bar)}>
          <VersionPair
            versions={props.comparison.versions}
            left={props.comparison.selected?.from ?? first()}
            right={props.comparison.selected?.to ?? last()}
            action="#banding"
            submitLabel="Bandingkan"
            href={pairLink}
          />
        </div>
        <p class={css(styles.presets)}>
          <span class={css(styles.muted)}>Cepat:</span>
          <a
            class={css(linkStyles.base, styles.preset)}
            href={pairLink(first(), last())}
          >
            Asli dan terbaru
          </a>
          <a
            class={css(linkStyles.base, styles.preset)}
            href={pairLink(before(), last())}
          >
            Perubahan terakhir
          </a>
        </p>
        {props.comparison.unknown && (
          <output>Versi yang diminta tidak dikenal di koleksi ini.</output>
        )}
        <Result comparison={props.comparison} />
      </section>
    </Show>
  );
};
