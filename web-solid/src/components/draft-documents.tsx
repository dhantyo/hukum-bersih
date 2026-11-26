import * as stylex from "@stylexjs/stylex";
import { For } from "solid-js";

import {
  docTypeLabel,
  PROVENANCE,
  provenanceKey,
  tanggal,
} from "../lib/labels.ts";
import { slashed } from "../lib/paths.ts";
import { isPresent } from "../lib/text.ts";
import { Router } from "../router.tsx";
import type { DraftBill, DraftDocument } from "../server/records/draft.ts";
import { css } from "../styles/css.ts";
import { linkClass } from "../styles/link.ts";
import { color, size, space } from "../styles/tokens.stylex.ts";
import { Badge } from "./badge.tsx";

const styles = stylex.create({
  legend: {
    color: color.textMuted,
    fontSize: size.sm,
  },
  list: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    borderBlockStartColor: color.line,
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: 1,
    maxInlineSize: size.measure,
  },
  row: {
    paddingBlock: space.s4,
    borderBlockEndColor: color.line,
    borderBlockEndStyle: "solid",
    borderBlockEndWidth: 1,
  },
  title: { fontWeight: 600 },
  muted: { color: color.textMuted, fontWeight: 400 },
  label: { fontSize: size.sm },
  meta: {
    color: color.textMuted,
    fontSize: size.sm,
    marginBlockStart: space.s1,
  },
  links: {
    gap: `${space.s1} ${space.s4}`,
    display: "flex",
    flexWrap: "wrap",
  },
});

const Legend = () => (
  <p class={css(styles.legend)}>
    Asal: <Badge tone="official">Resmi</Badge> dari situs lembaga negara,{" "}
    <Badge tone="archive">Arsip</Badge> dari arsip web,{" "}
    <Badge tone="media">Media</Badge> dari pemberitaan,{" "}
    <Badge tone="none">Belum ditemukan</Badge> diketahui ada tetapi berkasnya
    belum ditemukan (tidak pernah direka ulang).
  </p>
);

const DocumentRow = (props: { slug: string; document: DraftDocument }) => {
  const provenance = () => PROVENANCE[provenanceKey(props.document.provenance)];
  const href = () => slashed(Router.paths.ruu(props.slug, props.document.id));
  const title = () => docTypeLabel(props.document.type);

  const hasLinks = () =>
    isPresent(props.document.source_url) ||
    isPresent(props.document.archive_url);

  return (
    <li class={css(styles.row)} id={props.document.id}>
      <div class={css(styles.title)}>
        {props.document.hasText ? (
          <a class={linkClass} href={href()}>
            {title()}
          </a>
        ) : (
          title()
        )}
        <span class={css(styles.muted)}> · {tanggal(props.document.date)}</span>{" "}
        <span title={provenance().hint}>
          <Badge tone={provenanceKey(props.document.provenance)}>
            {provenance().label}
          </Badge>
        </span>
      </div>
      {isPresent(props.document.label) && (
        <div class={css(styles.label)}>{props.document.label}</div>
      )}
      {isPresent(props.document.note) && (
        <div class={css(styles.meta)}>{props.document.note}</div>
      )}
      {hasLinks() && (
        <div class={css(styles.meta, styles.links)}>
          {props.document.hasText && (
            <a class={linkClass} href={href()}>
              Baca teks
            </a>
          )}
          {isPresent(props.document.source_url) && (
            <a class={linkClass} href={props.document.source_url}>
              Sumber
              {isPresent(props.document.obtained_by)
                ? ` (${props.document.obtained_by})`
                : ""}
            </a>
          )}
          {isPresent(props.document.archive_url) && (
            <a class={linkClass} href={props.document.archive_url}>
              PDF arsip
            </a>
          )}
        </div>
      )}
    </li>
  );
};

/** "Dokumen dan versi": every document known for a bill, newest first, with where it came from. */
export const DraftDocuments = (props: {
  slug: string;
  documents: DraftBill["documents"];
}) => (
  <>
    <Legend />
    <ul class={css(styles.list)}>
      <For
        each={props.documents.toSorted((a, b) => b.date.localeCompare(a.date))}
      >
        {(document) => <DocumentRow slug={props.slug} document={document} />}
      </For>
    </ul>
  </>
);
