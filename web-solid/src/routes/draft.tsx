import type { RouteProps } from "@solidjs/router";
import * as stylex from "@stylexjs/stylex";
import { createMemo, Show } from "solid-js";

import { Badge } from "../components/badge.tsx";
import { DocLayout } from "../components/doc-layout.tsx";
import { DraftDocuments } from "../components/draft-documents.tsx";
import { draftVersionName } from "../components/draft-provenance.tsx";
import { DraftStages } from "../components/draft-stages.tsx";
import { Facts } from "../components/law-panel.tsx";
import { PageTitle } from "../components/page-title.tsx";
import { stageLabel, tanggal } from "../lib/labels.ts";
import { slashed } from "../lib/paths.ts";
import { draftBillQuery } from "../lib/queries.ts";
import { isPresent } from "../lib/text.ts";
import { Router } from "../router.tsx";
import type { DraftBill } from "../server/records/draft.ts";
import { css } from "../styles/css.ts";
import { linkStyles } from "../styles/link.ts";
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
  compare: {
    borderColor: color.link,
    borderRadius: size.radiusMd,
    borderStyle: "solid",
    borderWidth: { default: 1, ":hover": 2 },
    paddingBlock: {
      default: space.s4,
      ":hover": `calc(${space.s4} - 1px)`,
    },
    paddingInline: {
      default: space.s5,
      ":hover": `calc(${space.s5} - 1px)`,
    },
    textDecoration: "none",
    backgroundColor: color.linkBackground,
    boxSizing: "border-box",
    color: color.text,
    display: "block",
    maxInlineSize: size.measure,
  },
  compareLabel: { color: color.link, display: "block", fontWeight: 600 },
});

const comparedVersions = (draft: DraftBill) => {
  const versions = draft.documents
    .filter((document) => document.hasText)
    .toSorted((a, b) => a.date.localeCompare(b.date));

  const [oldest, newest] = [versions.at(0), versions.at(-1)];

  return oldest === undefined || newest === undefined || oldest === newest
    ? null
    : { oldest, newest };
};

const HeadMeta = (props: { draft: DraftBill }) => (
  <div class={css(styles.meta)}>
    {isPresent(props.draft.enacted_as) ? (
      <Badge tone="berlaku">Disahkan</Badge>
    ) : (
      <Badge tone="diubah">Belum diundangkan</Badge>
    )}
    <Show when={props.draft.stages.at(-1)} keyed>
      {(last) => (
        <span class={css(styles.muted)}>
          Tahap terakhir: {stageLabel(last.stage)}, {tanggal(last.date)}
        </span>
      )}
    </Show>
  </div>
);

const draftFacts = (draft: DraftBill) => [
  { label: "Pengusul", value: draft.initiator },
  { label: "Judul sebelumnya", value: draft.former_titles?.join("; ") },
  { label: "Disahkan sebagai", value: draft.enacted_as },
  {
    label: "Versi teks",
    value: `${draft.documents.filter((document) => document.hasText).length} dari ${draft.documents.length} dokumen yang diketahui`,
  },
  {
    label: "Halaman DPR",
    value: isPresent(draft.dpr_page) ? "dpr.go.id" : null,
    href: draft.dpr_page,
  },
];

const DraftBillPage = (props: RouteProps<"/ruu/:slug">) => {
  const bill = createMemo(async () => await draftBillQuery(props.params.slug));

  return (
    <Show when={bill()} fallback={<NotFound />} keyed>
      {(draft) => {
        const compared = comparedVersions(draft);

        return (
          <>
            <PageTitle>{draft.name}</PageTitle>
            <DocLayout
              crumbs={[
                { href: slashed(Router.paths.ruu), label: "RUU" },
                { label: draft.name },
              ]}
              eyebrow="Rancangan Undang-Undang"
              title={draft.name}
              subtitle={draft.title}
              headMeta={<HeadMeta draft={draft} />}
              panelLabel="Keterangan"
              panel={<Facts title="Keterangan" facts={draftFacts(draft)} />}
            >
              <Show when={compared} keyed>
                {({ oldest, newest }) => (
                  <a
                    class={css(linkStyles.base, styles.compare)}
                    href={slashed(
                      Router.paths
                        .ruu(props.params.slug)
                        .beda(`${oldest.id}...${newest.id}`)
                    )}
                  >
                    <span class={css(styles.compareLabel)}>
                      Apa yang berubah?
                    </span>
                    <span>
                      {draftVersionName(oldest)} → {draftVersionName(newest)},
                      pasal demi pasal
                    </span>
                  </a>
                )}
              </Show>
              <h2>Perjalanan</h2>
              <DraftStages stages={draft.stages} />
              <h2>Dokumen dan versi</h2>
              <DraftDocuments
                slug={props.params.slug}
                documents={draft.documents}
              />
            </DocLayout>
          </>
        );
      }}
    </Show>
  );
};

export default DraftBillPage;
