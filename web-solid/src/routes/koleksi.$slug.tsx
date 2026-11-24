import { useQuery } from '@tanstack/solid-query';
import { createFileRoute, notFound } from '@tanstack/solid-router';
import { Show } from 'solid-js';
import { CollectionReader } from '../CollectionReader';
import { collectionQuery } from '../lib/queries';

export const Route = createFileRoute('/koleksi/$slug')({
  loader: async ({ context, params }) => {
    const collection = await context.queryClient.ensureQueryData(collectionQuery(params.slug));
    if (!collection) throw notFound();
    return { name: collection.name };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.name ?? 'Koleksi'} | Hukum Bersih` }, { name: 'robots', content: 'noindex' }],
  }),
  component: CollectionPage,
});

function CollectionPage() {
  const params = Route.useParams();
  const collection = useQuery(() => collectionQuery(params().slug));
  return <Show when={collection.data} keyed>{(record) =>
    <CollectionReader collection={record} />
  }</Show>;
}
