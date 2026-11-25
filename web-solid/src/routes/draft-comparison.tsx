import type { RouteProps } from "@solidjs/router";
import * as stylex from "@stylexjs/stylex";
import { createMemo, createSignal, For, Show } from "solid-js";

import {
  DraftProvenance,
  draftVersionName,
} from "../components/draft-provenance.tsx";
import { LabelledCheckbox } from "../components/labelled-checkbox.tsx";
import { SynopsisRow } from "../components/synopsis-row.tsx";
import { usePageTitle } from "../lib/head.ts";
import { slashed } from "../lib/paths.ts";
import { draftComparisonQuery } from "../lib/queries.ts";
import { Router } from "../router.tsx";
import type { DraftDocument } from "../server/records/draft.ts";
import { css } from "../styles/css.ts";
import { linkClass } from "../styles/link.ts";
import { synopsisStyles as styles } from "../styles/synopsis.ts";
import NotFound from "./not-found.tsx";

const yearOf = (document: DraftDocument) => document.date.slice(0, 4);

const VersionCard = (props: {
  slug: string;
  heading: string;
  document: DraftDocument;
}) => (
  <div class={css(styles.card)}>
    <div class={css(styles.muted)}>{props.heading}</div>
    <a
      class={linkClass}
      href={slashed(Router.paths.ruu(props.slug, props.document.id))}
    >
      <strong>{draftVersionName(props.document)}</strong>
    </a>
    <DraftProvenance document={props.document} />
  </div>
);

const DraftComparisonPage = (props: RouteProps<"/ruu/:slug/beda/:pair">) => {
  const comparison = createMemo(
    async () => await draftComparisonQuery(props.params.slug, props.params.pair)
  );

  const [showSame, setShowSame] = createSignal(false);

  return (
    <Show when={comparison()} fallback={<NotFound />} keyed>
      {(record) => {
        usePageTitle(() => `${record.name}: perbandingan`);

        const { counts } = record;

        return (
          <main class={css(styles.page)}>
            <nav aria-label="Lokasi">
              <a class={linkClass} href={slashed(Router.paths.ruu)}>
                RUU
              </a>
              <span aria-hidden="true"> › </span>
              <a
                class={linkClass}
                href={slashed(Router.paths.ruu(props.params.slug))}
              >
                {record.name}
              </a>
              <span aria-hidden="true"> › </span>
              <span>Perbandingan</span>
            </nav>
            <h1>Apa yang berubah?</h1>
            <div class={css(styles.versions)}>
              <VersionCard
                slug={props.params.slug}
                heading="Dari"
                document={record.older}
              />
              <VersionCard
                slug={props.params.slug}
                heading="Menjadi"
                document={record.newer}
              />
            </div>
            <div class={css(styles.card)}>
              <span class={css(styles.summaryCount)}>
                <strong>{counts.berubah}</strong> pasal berubah
              </span>
              <span class={css(styles.summaryCount)}>
                <strong>{counts.baru}</strong> pasal baru
              </span>
              <span class={css(styles.summaryCount)}>
                <strong>{counts.dihapus}</strong> pasal dihapus
              </span>
              <span class={css(styles.summaryCount)}>
                <strong>{counts.sama}</strong> tidak berubah
              </span>
              <div class={css(styles.muted)}>
                Nomor pasal bergeser antarversi, jadi pasal dicocokkan
                berdasarkan isinya, bukan nomornya.
                {counts.renumbered > 0 &&
                  ` ${counts.renumbered} pasal berganti nomor.`}{" "}
                Pencocokan dilakukan otomatis; periksa teks lengkapnya untuk
                kepastian.
              </div>
              <LabelledCheckbox
                label="Tampilkan juga pasal yang isi dan nomornya tidak berubah"
                checked={showSame()}
                onChange={(checked) => {
                  setShowSame(checked);
                }}
              />
            </div>
            <div
              class={css(styles.synopsis, stylex.defaultMarker())}
              data-hide-same={showSame() ? undefined : ""}
            >
              <div class={css(styles.head)}>
                <div>{draftVersionName(record.older)}</div>
                <div>{draftVersionName(record.newer)}</div>
              </div>
              <For each={record.rows}>
                {(row) => (
                  <>
                    <Show when={row.chapter} keyed>
                      {(chapter) => (
                        <div class={css(styles.chapter)}>{chapter}</div>
                      )}
                    </Show>
                    <SynopsisRow
                      row={row}
                      versions={{
                        a: yearOf(record.older),
                        b: yearOf(record.newer),
                      }}
                    />
                  </>
                )}
              </For>
            </div>
          </main>
        );
      }}
    </Show>
  );
};

export default DraftComparisonPage;
