import { createFileRoute } from '@tanstack/solid-router';
import { For } from 'solid-js';
import { getCollections } from '../lib/collections';

export const Route = createFileRoute('/koleksi/')({
  loader: () => getCollections(),
  head: () => ({ meta: [{ title: 'Koleksi | Hukum Bersih' }, { name: 'robots', content: 'noindex' }] }),
  component: CollectionIndex,
});

function CollectionIndex() {
  const collections = Route.useLoaderData();
  return <main>
    <h1>Koleksi</h1>
    <ul><For each={collections()}>{(collection) => <li>
      <a href={collection.u}>{collection.name}</a>
      {collection.named && collection.t !== collection.name && <p>{collection.t}</p>}
    </li>}</For></ul>
  </main>;
}
