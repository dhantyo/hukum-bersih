import { createFileRoute, notFound } from '@tanstack/solid-router';
import { For } from 'solid-js';
import { getCollection } from '../lib/collections';

export const Route = createFileRoute('/koleksi/$slug')({
  loader: async ({ params }) => {
    const collection = await getCollection(params.slug);
    if (!collection) throw notFound();
    return collection;
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.name ?? 'Koleksi'} | Hukum Bersih` }, { name: 'robots', content: 'noindex' }],
  }),
  component: CollectionPage,
});

function CollectionPage() {
  const collection = Route.useLoaderData();
  return <main>
    <a href="/koleksi/">Koleksi</a>
    <h1>{collection().name}</h1>
    <p>{collection().title}</p>
    <h2 id="riwayat">Riwayat</h2>
    <ol><For each={collection().members}>{(member) => <li>
      <span>{member.role}</span>{' · '}
      {member.law ? <a href={member.law.u}>{member.law.c} · {member.law.t}</a> : member.id}
    </li>}</For></ol>
  </main>;
}
