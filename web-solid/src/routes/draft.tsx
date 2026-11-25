import type { RouteProps } from "@solidjs/router";
import { createMemo, For, Show } from "solid-js";

import { STAGE, tanggal } from "../../../web/src/lib/labels.ts";
import {
  DraftProvenance,
  draftDocumentTitle,
  draftVersionName,
} from "../components/draft-provenance.tsx";
import { usePageTitle } from "../lib/head.ts";
import { slashed } from "../lib/paths.ts";
import { draftBillQuery } from "../lib/queries.ts";
import { isPresent } from "../lib/text.ts";
import { Router } from "../router.tsx";
import type { DraftBill } from "../server/records/draft.ts";
import { linkClass } from "../styles/link.ts";
import NotFound from "./not-found.tsx";

const comparedVersions = (draft: DraftBill) => {
  const versions = draft.documents
    .filter((document) => document.hasText)
    .toSorted((a, b) => a.date.localeCompare(b.date));

  const [oldest, newest] = [versions.at(0), versions.at(-1)];

  return oldest === undefined || newest === undefined || oldest === newest
    ? null
    : { oldest, newest };
};

const DraftBillPage = (props: RouteProps<"/ruu/:slug">) => {
  const bill = createMemo(async () => await draftBillQuery(props.params.slug));

  return (
    <Show when={bill()} fallback={<NotFound />} keyed>
      {(draft) => {
        usePageTitle(() => draft.name);

        return (
          <main>
            <a class={linkClass} href={slashed(Router.paths.ruu)}>
              RUU
            </a>
            <h1>{draft.name}</h1>
            {draft.title !== draft.name && <p>{draft.title}</p>}
            <p>
              {isPresent(draft.enacted_as)
                ? `Disahkan sebagai ${draft.enacted_as}`
                : "Belum diundangkan"}
            </p>
            {isPresent(draft.initiator) && <p>Pengusul: {draft.initiator}</p>}
            {(draft.former_titles?.length ?? 0) > 0 && (
              <p>Judul sebelumnya: {draft.former_titles?.join(", ")}</p>
            )}
            {isPresent(draft.dpr_page) && (
              <p>
                <a class={linkClass} href={draft.dpr_page}>
                  Halaman DPR
                </a>
              </p>
            )}
            <Show when={comparedVersions(draft)} keyed>
              {({ oldest, newest }) => (
                <p>
                  <a
                    class={linkClass}
                    href={slashed(
                      Router.paths
                        .ruu(props.params.slug)
                        .beda(`${oldest.id}...${newest.id}`)
                    )}
                  >
                    <strong>Apa yang berubah?</strong>{" "}
                    {draftVersionName(oldest)} → {draftVersionName(newest)},
                    pasal demi pasal
                  </a>
                </p>
              )}
            </Show>
            <h2>Perjalanan</h2>
            <ol>
              <For each={draft.stages}>
                {(stage) => (
                  <li>
                    {STAGE[stage.stage] ?? stage.stage} · {tanggal(stage.date)}
                    {isPresent(stage.note) ? ` · ${stage.note}` : ""}
                  </li>
                )}
              </For>
            </ol>
            <h2>Dokumen dan versi</h2>
            <ul>
              <For
                each={draft.documents.toSorted((a, b) =>
                  b.date.localeCompare(a.date)
                )}
              >
                {(document) => (
                  <li id={document.id}>
                    {document.hasText ? (
                      <a
                        class={linkClass}
                        href={slashed(
                          Router.paths.ruu(props.params.slug, document.id)
                        )}
                      >
                        {draftDocumentTitle(document)}
                      </a>
                    ) : (
                      draftDocumentTitle(document)
                    )}
                    <DraftProvenance document={document} />
                  </li>
                )}
              </For>
            </ul>
          </main>
        );
      }}
    </Show>
  );
};

export default DraftBillPage;
