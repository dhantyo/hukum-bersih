import type { RouteProps } from "@solidjs/router";
import * as stylex from "@stylexjs/stylex";
import { createMemo, For, Show } from "solid-js";

import { Badge } from "../components/badge.tsx";
import { DocLayout } from "../components/doc-layout.tsx";
import { draftVersionName } from "../components/draft-provenance.tsx";
import { Facts } from "../components/law-panel.tsx";
import { LawText } from "../components/law-text.tsx";
import { Toc } from "../components/law-toc.tsx";
import { usePageTitle } from "../lib/head.ts";
import {
  docTypeLabel,
  PROVENANCE,
  provenanceKey,
  tanggal,
} from "../lib/labels.ts";
import { slashed } from "../lib/paths.ts";
import { draftTextQuery } from "../lib/queries.ts";
import { isPresent } from "../lib/text.ts";
import { Router } from "../router.tsx";
import type { DraftDocument as DraftDocumentRecord } from "../server/records/draft.ts";
import { css } from "../styles/css.ts";
import { linkClass } from "../styles/link.ts";
import { color, size, space } from "../styles/tokens.stylex.ts";
import NotFound from "./not-found.tsx";

const styles = stylex.create({
  meta: {
    gap: `${space.s2} ${space.s4}`,
    alignItems: "center",
    display: "flex",
    flexWrap: "wrap",
  },
  muted: { color: color.textMuted, fontSize: size.sm },
  notice: {
    borderRadius: size.radiusMd,
    paddingBlock: space.s2,
    paddingInline: space.s3,
    backgroundColor: color.backgroundSubtle,
    boxSizing: "border-box",
    fontSize: size.sm,
    maxInlineSize: size.measure,
  },
  compare: { fontSize: size.sm, marginBlockStart: space.s3 },
});

const Provenance = (props: { document: DraftDocumentRecord }) => {
  const provenance = () => PROVENANCE[provenanceKey(props.document.provenance)];

  return (
    <div class={css(styles.meta)}>
      <Badge tone={provenanceKey(props.document.provenance)}>
        {provenance().label}
      </Badge>
      <span class={css(styles.muted)}>{provenance().hint}</span>
    </div>
  );
};

type DraftDocumentView = NonNullable<
  Awaited<ReturnType<typeof draftTextQuery>>
>;

const documentFacts = (document: DraftDocumentRecord) => [
  { label: "Keterangan", value: document.label },
  { label: "Catatan", value: document.note },
  { label: "Diperoleh dari", value: document.obtained_by },
  {
    label: "Sumber",
    value: isPresent(document.source_url)
      ? new URL(document.source_url).hostname
      : null,
    href: document.source_url,
  },
  {
    label: "Salinan arsip",
    value: isPresent(document.archive_url) ? "PDF di archive.org" : null,
    href: document.archive_url,
  },
];

const CompareLinks = (props: {
  slug: string;
  others: DraftDocumentView["comparable"];
}) => (
  <For each={props.others}>
    {(other) => (
      <p class={css(styles.compare)}>
        <a
          class={linkClass}
          href={slashed(Router.paths.ruu(props.slug).beda(other.pair))}
        >
          Bandingkan dengan {docTypeLabel(other.type)} ({tanggal(other.date)})
        </a>
      </p>
    )}
  </For>
);

const DraftDocument = (props: RouteProps<"/ruu/:slug/:doc">) => {
  const draft = createMemo(
    async () => await draftTextQuery(props.params.slug, props.params.doc)
  );

  return (
    <Show when={draft()} fallback={<NotFound />} keyed>
      {(record) => {
        usePageTitle(
          () => `${record.name}: ${draftVersionName(record.document)}`
        );

        return (
          <DocLayout
            crumbs={[
              { href: slashed(Router.paths.ruu), label: "RUU" },
              {
                href: slashed(Router.paths.ruu(props.params.slug)),
                label: record.name,
              },
              { label: draftVersionName(record.document) },
            ]}
            eyebrow={record.name}
            title={`${docTypeLabel(record.document.type)}, ${tanggal(record.document.date)}`}
            subtitle={record.document.ruu_title ?? record.title}
            headMeta={<Provenance document={record.document} />}
            text={record.text}
            panelLabel="Keterangan"
            panel={
              <>
                <Facts title="Dokumen" facts={documentFacts(record.document)}>
                  <CompareLinks
                    slug={props.params.slug}
                    others={record.comparable}
                  />
                </Facts>
                <Toc text={record.text} />
              </>
            }
          >
            <p class={css(styles.notice)}>
              Teks diambil otomatis dari PDF dan bisa memuat kesalahan baca;
              PDF-nya yang berlaku.
            </p>
            <LawText text={record.text} />
          </DocLayout>
        );
      }}
    </Show>
  );
};

export default DraftDocument;
