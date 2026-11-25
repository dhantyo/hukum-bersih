import type { RouteProps } from "@solidjs/router";
import * as stylex from "@stylexjs/stylex";
import { createMemo, Show } from "solid-js";

import { Badge } from "../components/badge.tsx";
import { DocLayout } from "../components/doc-layout.tsx";
import { Facts } from "../components/law-panel.tsx";
import { LawText } from "../components/law-text.tsx";
import { usePageTitle } from "../lib/head.ts";
import { PROVENANCE, provenanceKey } from "../lib/labels.ts";
import { slashed } from "../lib/paths.ts";
import { draftTextQuery } from "../lib/queries.ts";
import { isPresent } from "../lib/text.ts";
import { draftDocumentTitle } from "../lib/titles.ts";
import { Router } from "../router.tsx";
import type { DraftDocument as DraftDocumentRecord } from "../server/records/draft.ts";
import { css } from "../styles/css.ts";
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

const DraftDocument = (props: RouteProps<"/ruu/:slug/:doc">) => {
  const draft = createMemo(
    async () => await draftTextQuery(props.params.slug, props.params.doc)
  );

  return (
    <Show when={draft()} fallback={<NotFound />} keyed>
      {(record) => {
        usePageTitle(
          () => `${record.name}: ${draftDocumentTitle(record.document)}`
        );

        return (
          <DocLayout
            crumbs={[
              { href: slashed(Router.paths.ruu), label: "RUU" },
              {
                href: slashed(Router.paths.ruu(props.params.slug)),
                label: record.name,
              },
              { label: draftDocumentTitle(record.document) },
            ]}
            eyebrow={record.name}
            title={draftDocumentTitle(record.document)}
            subtitle={record.document.ruu_title ?? record.title}
            headMeta={<Provenance document={record.document} />}
            text={record.text}
            panelLabel="Keterangan"
            panel={
              <Facts title="Dokumen" facts={documentFacts(record.document)} />
            }
          >
            <p class={css(styles.notice)}>
              Teks diambil otomatis dari PDF dan bisa memuat kesalahan baca.
            </p>
            <LawText text={record.text} />
          </DocLayout>
        );
      }}
    </Show>
  );
};

export default DraftDocument;
