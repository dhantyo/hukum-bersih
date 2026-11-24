import { useQuery } from "@tanstack/solid-query";
import { createFileRoute, getRouteApi, notFound } from "@tanstack/solid-router";
import { Show } from "solid-js";

import {
  DraftProvenance,
  draftDocumentTitle,
} from "../components/draft-provenance.tsx";
import { LawText } from "../components/law-text.tsx";
import { draftTextQuery } from "../lib/queries";
import { readerClass } from "../styles/reading.ts";

const route = getRouteApi("/ruu/$slug_/$doc");

const DraftText = () => {
  const params = route.useParams();
  const draft = useQuery(() => draftTextQuery(params().slug, params().doc));

  return (
    <Show when={draft.data} keyed>
      {(record) => (
        <main class={readerClass}>
          <a href={`/ruu/${params().slug}/`}>{record.name}</a>
          <h1>{draftDocumentTitle(record.document)}</h1>
          <p>{record.document.ruu_title ?? record.title}</p>
          <DraftProvenance document={record.document} />
          <p>Teks diambil otomatis dari PDF dan bisa memuat kesalahan baca.</p>
          <LawText text={record.text} />
        </main>
      )}
    </Show>
  );
};

export const Route = createFileRoute("/ruu/$slug_/$doc")({
  loader: async ({ context, params }) => {
    const draft = await context.queryClient.query({
      ...draftTextQuery(params.slug, params.doc),
      staleTime: "static",
    });

    if (draft === null) {
      throw notFound();
    }

    return { title: `${draft.name}: ${draftDocumentTitle(draft.document)}` };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.title ?? "RUU"} | Hukum Bersih` }],
  }),
  component: DraftText,
});
