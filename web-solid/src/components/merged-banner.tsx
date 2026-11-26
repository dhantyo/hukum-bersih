import * as stylex from "@stylexjs/stylex";
import { For, Show } from "solid-js";

import { pasalKey } from "../lib/display.ts";
import { tanggal } from "../lib/labels.ts";
import { isPresent } from "../lib/text.ts";
import type { CollectionVersion } from "../server/records/collection-version.ts";
import { css } from "../styles/css.ts";
import { linkClass } from "../styles/link.ts";
import { color, size, space } from "../styles/tokens.stylex.ts";

const styles = stylex.create({
  box: {
    borderColor: {
      default: color.line,
      ":is([data-incomplete])": color.warn,
    },
    borderRadius: size.radiusMd,
    borderStyle: "solid",
    borderWidth: 1,
    paddingBlock: space.s3,
    paddingInline: space.s4,
    boxSizing: "border-box",
    fontSize: size.sm,
    marginBlockEnd: space.s5,
    maxInlineSize: size.measure,
  },
  line: { margin: 0 },
  next: { marginBlockStart: space.s2 },
  head: { fontSize: size.base, fontWeight: 600 },
  headSmall: { fontSize: size.sm },
  list: {
    margin: 0,
    marginBlockStart: space.s2,
    paddingInlineStart: space.s5,
  },
  item: { marginBlockStart: { default: 0, ":not(:first-child)": space.s1 } },
  small: { color: color.textMuted },
});

type Citation = CollectionVersion["amendments"][number];

const CitationLink = (props: { citation: Citation }) => (
  <Show when={props.citation.href} fallback={props.citation.label} keyed>
    {(href) => (
      <a class={linkClass} href={href}>
        {props.citation.label}
      </a>
    )}
  </Show>
);

const Completeness = (props: { version: CollectionVersion }) => (
  <ul class={css(styles.list)}>
    {props.version.missing > 0 && (
      <li class={css(styles.item)}>
        {props.version.missing} perubahan sebelumnya belum tersedia di sini;
        pasal yang diubahnya mungkin belum sesuai.
      </li>
    )}
    {props.version.unreadable.length > 0 && (
      <li class={css(styles.item)}>
        Teks baru {props.version.unreadable.length} pasal belum terbaca, jadi
        yang ditampilkan teks sebelumnya:{" "}
        <For each={props.version.unreadable}>
          {(article, index) => (
            <>
              {index() > 0 && ", "}
              <a
                class={linkClass}
                href={`#pasal-${pasalKey(article)}`}
                target="_self"
              >
                Pasal {article}
              </a>
            </>
          )}
        </For>
        .
      </li>
    )}
    <For each={props.version.unapplied}>
      {(entry) => (
        <li class={css(styles.item)}>
          Ketentuan{" "}
          {entry.instruction === null ? "" : `angka ${entry.instruction} `}
          <CitationLink citation={entry.by} /> belum diterapkan: “{entry.header}
          ”
        </li>
      )}
    </For>
  </ul>
);

export const MergedBanner = (props: { version: CollectionVersion }) => (
  <aside
    class={css(styles.box)}
    data-incomplete={props.version.incomplete ? "" : undefined}
    aria-label="Tentang teks gabungan"
  >
    <p class={css(styles.line, styles.head)}>
      Teks gabungan per{" "}
      {isPresent(props.version.date)
        ? tanggal(props.version.date)
        : "tanggal tidak diketahui"}
      , disusun otomatis.
    </p>
    <p class={css(styles.line, styles.next)}>
      Gabungan{" "}
      <a class={linkClass} href={props.version.base.href}>
        {props.version.base.label}
      </a>{" "}
      dan perubahannya sampai{" "}
      <For each={props.version.amendments}>
        {(citation, index) => (
          <>
            {index() > 0 && " dan "}
            <CitationLink citation={citation} />
          </>
        )}
      </For>
      . Bukan teks konsolidasi resmi; teks asli setiap undang-undang ada di
      halamannya.
    </p>
    {props.version.incomplete && (
      <>
        <p class={css(styles.line, styles.next, styles.head, styles.headSmall)}>
          Belum lengkap:
        </p>
        <Completeness version={props.version} />
      </>
    )}
    {props.version.text.penjelasan.length > 0 && (
      <p class={css(styles.line, styles.next, styles.small)}>
        Penjelasan di bawah menurut teks asli {props.version.base.label};
        perubahan penjelasan belum digabung.
      </p>
    )}
  </aside>
);
