import { useQuery } from '@tanstack/solid-query';
import { createFileRoute, notFound } from '@tanstack/solid-router';
import { For, Show } from 'solid-js';
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
  return <Show when={collection.data} keyed>{(record) => <main>
    <a href="/koleksi/">Koleksi</a>
    <h1>{record.name}</h1>
    <p>{record.title}</p>
    <h2 id="riwayat">Riwayat</h2>
    <ol><For each={record.members}>{(member) => <li>
      <span>{member.role}</span>{' · '}
      {member.law ? <a href={member.law.u}>{member.law.c} · {member.law.t}</a> : member.id}
    </li>}</For></ol>
  </main>}</Show>;
}
