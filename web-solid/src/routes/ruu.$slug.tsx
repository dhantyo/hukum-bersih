import { useQuery } from "@tanstack/solid-query";
import { createFileRoute, getRouteApi, notFound } from "@tanstack/solid-router";
import { For, Show } from "solid-js";

import { STAGE, tanggal } from "../../../web/src/lib/labels.ts";
import {
  DraftProvenance,
  draftDocumentTitle,
} from "../components/draft-provenance.tsx";
import { draftBillQuery } from "../lib/queries";
import { isPresent } from "../lib/text.ts";

const route = getRouteApi("/ruu/$slug");

const DraftBill = () => {
  const params = route.useParams();
  const query = useQuery(() => draftBillQuery(params().slug));

  return (
    <Show when={query.data} keyed>
      {(draft) => (
        <main>
          <a href="/ruu/">RUU</a>
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
              <a href={draft.dpr_page}>Halaman DPR</a>
            </p>
          )}
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
                    <a href={`/ruu/${params().slug}/${document.id}/`}>
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
      )}
    </Show>
  );
};

export const Route = createFileRoute("/ruu/$slug")({
  loader: async ({ context, params }) => {
    const draft = await context.queryClient.query({
      ...draftBillQuery(params.slug),
      staleTime: "static",
    });

    if (draft === null) {
      throw notFound();
    }

    return { title: draft.name };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.title ?? "RUU"} | Hukum Bersih` }],
  }),
  component: DraftBill,
});
