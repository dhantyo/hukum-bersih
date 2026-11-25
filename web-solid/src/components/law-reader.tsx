import * as stylex from "@stylexjs/stylex";
import { Show } from "solid-js";

import { tanggal } from "../lib/labels.ts";
import { isPresent } from "../lib/text.ts";
import { lawHeading } from "../lib/titles.ts";
import type { VersionComparison } from "../server/law-comparison.ts";
import type { LawRecord } from "../server/records/law.ts";
import { css } from "../styles/css.ts";
import { linkClass, linkStyles } from "../styles/link.ts";
import { color, size, space } from "../styles/tokens.stylex.ts";
import { DocLayout } from "./doc-layout.tsx";
import { KoleksiBox, RelationsBanner, StatusBanner } from "./law-banners.tsx";
import { CompareBar } from "./law-compare.tsx";
import { Facts, Versions } from "./law-panel.tsx";
import { LawText } from "./law-text.tsx";
import { Toc } from "./law-toc.tsx";
import { ReadingSettings } from "./reading-settings.tsx";

const styles = stylex.create({
  meta: {
    gap: `${space.s2} ${space.s4}`,
    alignItems: "center",
    display: "flex",
    flexWrap: "wrap",
  },
  badge: {
    borderColor: color.lineStrong,
    borderRadius: 999,
    borderStyle: "solid",
    borderWidth: 1,
    paddingBlock: space.hairline,
    paddingInline: space.s2,
    fontSize: size.sm,
    fontWeight: 600,
  },
  muted: { color: color.textMuted, fontSize: size.sm },
  notice: {
    borderRadius: size.radiusMd,
    paddingBlock: space.s3,
    paddingInline: space.s4,
    backgroundColor: color.backgroundSubtle,
    boxSizing: "border-box",
    marginBlockEnd: space.s4,
    maxInlineSize: size.measure,
  },
  paragraph: { margin: 0 },
  button: {
    borderColor: color.lineStrong,
    borderRadius: size.radius,
    borderStyle: "solid",
    borderWidth: 1,
    paddingBlock: space.s2,
    paddingInline: space.s4,
    textDecoration: "none",
    display: "inline-block",
    marginBlockStart: space.s2,
  },
});

const missingReason = {
  ocr: "PDF resminya berupa hasil pindaian tanpa lapisan teks; teksnya akan diambil dengan OCR.",
  unparsed:
    "Struktur PDF resminya belum bisa dibaca dengan benar; kami tidak menampilkan teks yang mungkin keliru.",
  pending: "PDF resminya belum diproses.",
} as const;

const crumbs = (law: LawRecord) =>
  law.family?.named === true
    ? [
        { href: "/koleksi/", label: "Koleksi" },
        { href: `/koleksi/${law.family.slug}/`, label: law.family.name },
        { label: law.cite },
      ]
    : [
        { href: "/uu/", label: "Undang-Undang" },
        { href: `/uu/tahun/${law.year}/`, label: String(law.year) },
        { label: law.cite },
      ];

const HeadMeta = (props: { law: LawRecord }) => (
  <div class={css(styles.meta)}>
    <Show when={props.law.status}>
      {(status) => (
        <span class={css(styles.badge)} data-status={status()}>
          {props.law.statusLabel ?? status()}
        </span>
      )}
    </Show>
    <Show when={props.law.date}>
      {(date) => (
        <span class={css(styles.muted)}>Ditetapkan {tanggal(date())}</span>
      )}
    </Show>
    <Show when={props.law.pasalCount}>
      {(count) => <span class={css(styles.muted)}>{count()} pasal</span>}
    </Show>
    <Show when={props.law.amendmentCount > 0}>
      <a
        class={css(styles.badge, linkStyles.base)}
        href={
          props.law.family === undefined
            ? undefined
            : `/koleksi/${props.law.family.slug}/${
                props.law.family.versions.length > 0 ? "" : "#riwayat"
              }`
        }
      >
        diubah {props.law.amendmentCount}×
      </a>
    </Show>
  </div>
);

const Panel = (props: { law: LawRecord; comparison?: VersionComparison }) => (
  <>
    <Show when={props.law.family}>
      {(family) => (
        <Show when={family().versions.length > 0}>
          <Versions family={family()} />
        </Show>
      )}
    </Show>
    <Show when={props.law.text}>
      {(text) => <Toc text={text()} comparison={props.comparison} />}
    </Show>
    <Facts
      title="Keterangan"
      facts={[
        {
          label: "Ditetapkan",
          value: isPresent(props.law.date)
            ? `${tanggal(props.law.date)}${isPresent(props.law.place) ? `, ${props.law.place}` : ""}`
            : null,
        },
        { label: "Oleh", value: props.law.official },
        { label: "Pemrakarsa", value: props.law.initiator },
      ]}
    />
    <Facts
      title="Sumber"
      facts={[
        {
          label: "Halaman resmi",
          value: props.law.sourceName,
          href: props.law.source,
        },
        {
          label: "PDF resmi",
          value: isPresent(props.law.pdf) ? "Unduh PDF" : null,
          href: props.law.pdf,
        },
        {
          label: "Salinan arsip",
          value: isPresent(props.law.archive) ? "archive.org" : null,
          href: props.law.archive,
        },
      ]}
    />
  </>
);

const Body = (props: { law: LawRecord; comparison?: VersionComparison }) => (
  <>
    <StatusBanner law={props.law} />
    <Show
      when={props.law.family}
      fallback={<RelationsBanner law={props.law} />}
    >
      {(family) => (
        <Show when={family().versions.length === 0}>
          <KoleksiBox family={family()} />
        </Show>
      )}
    </Show>
    <Show
      when={props.law.text}
      fallback={
        <div class={css(styles.notice)}>
          <p class={css(styles.paragraph)}>
            <strong>Teks belum tersedia.</strong>
          </p>
          <p class={css(styles.paragraph)}>
            {missingReason[props.law.missingText ?? "pending"]}
          </p>
          <Show when={props.law.pdf}>
            {(pdf) => (
              <a class={css(styles.button, linkStyles.base)} href={pdf()}>
                Buka PDF resmi
              </a>
            )}
          </Show>
        </div>
      }
    >
      {(text) => (
        <>
          <p class={css(styles.notice)}>
            Teks ini diambil otomatis dari PDF resmi dan bisa memuat kesalahan
            baca. Bila ragu, periksa{" "}
            <a class={linkClass} href={props.law.pdf ?? props.law.source}>
              PDF resminya
            </a>
            .
          </p>
          <Show when={props.comparison}>
            {(comparison) => <CompareBar comparison={comparison()} />}
          </Show>
          <LawText
            text={text()}
            notes={props.law.notes}
            comparison={props.comparison}
          />
        </>
      )}
    </Show>
  </>
);

export const LawReader = (props: {
  law: LawRecord;
  comparison?: VersionComparison;
}) => {
  const text = () => props.law.text;

  return (
    <DocLayout
      crumbs={crumbs(props.law)}
      eyebrow={props.law.title}
      title={lawHeading(props.law)}
      headMeta={<HeadMeta law={props.law} />}
      tools={
        <Show when={text()}>{(body) => <ReadingSettings text={body()} />}</Show>
      }
      panelLabel={text() ? "Daftar isi" : "Keterangan"}
      panel={<Panel law={props.law} comparison={props.comparison} />}
    >
      <Body law={props.law} comparison={props.comparison} />
    </DocLayout>
  );
};
