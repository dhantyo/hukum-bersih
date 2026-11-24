import type { RouteProps } from "@solidjs/router";
import { createMemo, Show } from "solid-js";

import {
  DraftProvenance,
  draftDocumentTitle,
} from "../components/draft-provenance.tsx";
import { LawText } from "../components/law-text.tsx";
import { ReadingSettings } from "../components/reading-settings.tsx";
import { usePageTitle } from "../lib/head.ts";
import { slashed } from "../lib/paths.ts";
import { draftTextQuery } from "../lib/queries.ts";
import { Router } from "../router.tsx";
import { readerClass } from "../styles/reading.ts";
import NotFound from "./not-found.tsx";

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
          <main class={readerClass}>
            <a href={slashed(Router.paths.ruu(props.params.slug))}>
              {record.name}
            </a>
            <h1>{draftDocumentTitle(record.document)}</h1>
            <p>{record.document.ruu_title ?? record.title}</p>
            <DraftProvenance document={record.document} />
            <p>
              Teks diambil otomatis dari PDF dan bisa memuat kesalahan baca.
            </p>
            <ReadingSettings text={record.text} />
            <LawText text={record.text} />
          </main>
        );
      }}
    </Show>
  );
};

export default DraftDocument;
