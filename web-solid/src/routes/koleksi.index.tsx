import { useQuery } from '@tanstack/solid-query';
import { createFileRoute } from '@tanstack/solid-router';
import { For } from 'solid-js';
import { collectionsQuery } from '../lib/queries';

export const Route = createFileRoute('/koleksi/')({
  loader: async ({ context }) => { await context.queryClient.ensureQueryData(collectionsQuery()); },
  head: () => ({ meta: [{ title: 'Koleksi | Hukum Bersih' }, { name: 'robots', content: 'noindex' }] }),
  component: CollectionIndex,
});

function CollectionIndex() {
  const collections = useQuery(() => collectionsQuery());
  return <main>
    <h1>Koleksi</h1>
    <ul><For each={collections.data}>{(collection) => <li>
      <a href={collection.u}>{collection.name}</a>
      {collection.named && collection.t !== collection.name && <p>{collection.t}</p>}
    </li>}</For></ul>
  </main>;
}
