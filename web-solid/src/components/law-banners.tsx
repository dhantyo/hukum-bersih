import * as stylex from "@stylexjs/stylex";
import { For, Show } from "solid-js";

import { tanggal } from "../../../web/src/lib/labels.ts";
import { isPresent } from "../lib/text.ts";
import type { Family, LawRecord } from "../server/records/law.ts";
import { css } from "../styles/css.ts";
import { linkClass } from "../styles/link.ts";
import { color, size, space } from "../styles/tokens.stylex.ts";

const styles = stylex.create({
  banner: {
    borderColor: {
      default: color.line,
      ":is([data-tone=changed], [data-tone=relations])": color.warn,
      ":is([data-tone=gone])": color.gone,
    },
    borderRadius: size.radiusMd,
    borderStyle: "solid",
    borderWidth: 1,
    paddingBlock: space.s3,
    paddingInline: space.s4,
    boxSizing: "border-box",
    marginBlockEnd: space.s5,
    maxInlineSize: size.measure,
  },
  line: { margin: 0 },
  next: { marginBlockStart: space.s1 },
  head: { fontWeight: 600 },
  muted: { color: color.textMuted },
  steps: {
    margin: 0,
    padding: 0,
    gap: `${space.s2} 1.6rem`,
    listStyle: "none",
    alignItems: "center",
    display: "flex",
    flexWrap: "wrap",
    fontSize: size.sm,
    marginBlockStart: space.s3,
  },
  step: {
    borderColor: {
      default: color.line,
      ":is([data-kind=here])": color.link,
      ":is([data-kind=missing])": color.gone,
    },
    borderRadius: 999,
    borderStyle: {
      default: "solid",
      ":is([data-kind=missing])": "dashed",
    },
    borderWidth: 1,
    gap: space.s1,
    paddingBlock: space.hairline,
    paddingInline: space.s2,
    alignItems: "baseline",
    backgroundColor: {
      default: null,
      ":is([data-kind=here])": color.linkBackground,
    },
    color: {
      default: null,
      ":is([data-kind=missing], [data-kind=pendahulu])": color.textMuted,
    },
    display: "inline-flex",
    fontWeight: { default: null, ":is([data-kind=here])": 600 },
  },
  links: {
    margin: 0,
    gap: space.s4,
    display: "flex",
    flexWrap: "wrap",
    fontSize: size.sm,
    marginBlockStart: space.s3,
  },
});

const Names = (props: {
  items: { label: string; href?: string; date?: string | null }[];
}) => (
  <For each={props.items}>
    {(item, index) => (
      <>
        {index() > 0 && (index() === props.items.length - 1 ? " dan " : ", ")}
        {isPresent(item.href) ? (
          <a class={linkClass} href={item.href}>
            {item.label}
          </a>
        ) : (
          item.label
        )}
        {isPresent(item.date) && <> ({tanggal(item.date)})</>}
      </>
    )}
  </For>
);

const Gone = (props: { law: LawRecord }) => {
  const archive = () =>
    props.law.text !== null &&
    " Teks di bawah ini disimpan sebagai arsip sejarah.";

  return (
    <aside
      class={css(styles.banner)}
      data-tone="gone"
      aria-label="Status undang-undang"
    >
      <p class={css(styles.line, styles.head)}>
        Undang-undang ini sudah tidak berlaku.
      </p>
      <p class={css(styles.line, styles.next)}>
        {props.law.revokedBy.length > 0 ? (
          <>
            Dicabut oleh <Names items={props.law.revokedBy} />.
          </>
        ) : (
          <>
            Menurut{" "}
            <a class={linkClass} href={props.law.source}>
              {props.law.sourceName}
            </a>
            , statusnya{" "}
            {props.law.status === "dicabut" ? "dicabut" : "tidak berlaku"}.
          </>
        )}
        {archive()}
      </p>
    </aside>
  );
};

const Changed = (props: { law: LawRecord }) => {
  const latest = () => props.law.family?.latestHref;

  const riwayat = () =>
    props.law.family === undefined
      ? undefined
      : `/koleksi/${props.law.family.slug}/#riwayat`;

  const changes = () => latest() ?? riwayat();

  return (
    <aside
      class={css(styles.banner)}
      data-tone="changed"
      aria-label="Status teks"
    >
      <p class={css(styles.line, styles.head)}>
        Ini teks asli tahun {props.law.date?.slice(0, 4) ?? props.law.year},
        belum memuat perubahannya.
      </p>
      <p class={css(styles.line, styles.next)}>
        Undang-undang ini sudah diubah {props.law.amendmentCount}×
        {Object.keys(props.law.notes).length > 0 &&
          `; ${Object.keys(props.law.notes).length} pasal ditandai “Diubah oleh” di bawah`}
        .{" "}
        {isPresent(latest())
          ? "Versi yang sudah digabung dengan perubahannya (disusun otomatis) ada di halaman koleksinya."
          : "Teks yang sudah digabung dengan perubahannya belum tersedia di sini."}
        <Show when={changes()}>
          {(href) => (
            <>
              {" "}
              <a class={linkClass} href={href()}>
                {isPresent(latest())
                  ? "Baca versi gabungan terbaru →"
                  : "Lihat riwayat perubahan →"}
              </a>
            </>
          )}
        </Show>
      </p>
    </aside>
  );
};

/** Above the text: whether it is the law as it stands (decision 0008). */
export const StatusBanner = (props: { law: LawRecord }) => {
  const gone = () =>
    props.law.status === "dicabut" || props.law.status === "tidak_berlaku";

  return (
    <Show when={!gone()} fallback={<Gone law={props.law} />}>
      <Show when={props.law.amendmentCount > 0 && props.law.text !== null}>
        <Changed law={props.law} />
      </Show>
    </Show>
  );
};

/** On a law that changes, revokes or confirms other laws. */
export const RelationsBanner = (props: { law: LawRecord }) => (
  <Show when={props.law.relations.length > 0}>
    <aside
      class={css(styles.banner)}
      data-tone="relations"
      aria-label="Hubungan dengan peraturan lain"
    >
      <For each={props.law.relations}>
        {(item) => (
          <p class={css(styles.line, styles.next)}>
            Undang-undang ini <strong>{item.verb}</strong>{" "}
            {isPresent(item.href) ? (
              <a class={linkClass} href={item.href}>
                {item.label}
              </a>
            ) : (
              item.label
            )}
            {item.count > 0 && (
              <span class={css(styles.muted)}>
                {" · "}
                {item.count} pasal
                {isPresent(item.href) && (
                  <>
                    {" ("}
                    <a class={linkClass} href={`${item.href}#riwayat`}>
                      lihat riwayat
                    </a>
                    {")"}
                  </>
                )}
              </span>
            )}
          </p>
        )}
      </For>
    </aside>
  </Show>
);

/** Which collection the law belongs to, its place in it and the collection's steps. */
export const KoleksiBox = (props: { family: Family }) => {
  const url = () => `/koleksi/${props.family.slug}/`;

  const hasMissing = () =>
    props.family.steps.some((step) => step.kind === "missing");

  return (
    <aside
      class={css(styles.banner)}
      aria-label={`Koleksi ${props.family.name}`}
    >
      <p class={css(styles.line)}>
        <a class={linkClass} href={url()}>
          <strong>Koleksi {props.family.name}</strong>
        </a>{" "}
        <span class={css(styles.muted)}>
          Undang-undang ini: <strong>{props.family.role.toLowerCase()}</strong>
        </span>
      </p>
      <ol class={css(styles.steps)} aria-label="Versi dalam koleksi ini">
        <For each={props.family.steps}>
          {(step) => (
            <li
              class={css(styles.step)}
              data-kind={step.here === true ? "here" : step.kind}
              title={step.title}
            >
              {step.here === true ? (
                <span aria-current="page">{step.label}</span>
              ) : (
                <>
                  {isPresent(step.href) ? (
                    <a class={linkClass} href={step.href}>
                      {step.label}
                    </a>
                  ) : (
                    step.label
                  )}
                </>
              )}
              {isPresent(step.order) && (
                <span class={css(styles.muted)}> {step.order}</span>
              )}
            </li>
          )}
        </For>
      </ol>
      <Show when={hasMissing()}>
        <p class={css(styles.line, styles.muted, styles.next)}>
          Garis putus-putus: perubahan yang diketahui ada, tetapi teksnya belum
          tersedia di sini.
        </p>
      </Show>
      <p class={css(styles.links)}>
        <a class={linkClass} href={`${url()}#riwayat`}>
          Riwayat koleksi →
        </a>
        <a class={linkClass} href={`${url()}#banding`}>
          Bandingkan versi →
        </a>
      </p>
    </aside>
  );
};
