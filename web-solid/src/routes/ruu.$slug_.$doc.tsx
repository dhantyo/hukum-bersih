import { useQuery } from '@tanstack/solid-query';
import { createFileRoute, notFound } from '@tanstack/solid-router';
import { Show } from 'solid-js';
import { DraftProvenance, draftDocumentTitle } from '../DraftProvenance';
import { LawText } from '../LawReader';
import { draftTextQuery } from '../lib/queries';
import '../reader.css';

export const Route = createFileRoute('/ruu/$slug_/$doc')({
  loader: async ({ context, params }) => {
    const draft = await context.queryClient.ensureQueryData(draftTextQuery(params.slug, params.doc));
    if (!draft) throw notFound();
    return { title: `${draft.name}: ${draftDocumentTitle(draft.document)}` };
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.title ?? 'RUU'} | Hukum Bersih` }] }),
  component: DraftText,
});

function DraftText() {
  const params = Route.useParams();
  const draft = useQuery(() => draftTextQuery(params().slug, params().doc));
  return <Show when={draft.data} keyed>{(record) => <main class="law-reader">
    <a href={`/ruu/${params().slug}/`}>{record.name}</a>
    <h1>{draftDocumentTitle(record.document)}</h1>
    <p>{record.document.ruu_title ?? record.title}</p>
    <DraftProvenance document={record.document} />
    <p>Teks diambil otomatis dari PDF dan bisa memuat kesalahan baca.</p>
    <LawText text={record.text} />
  </main>}</Show>;
}
