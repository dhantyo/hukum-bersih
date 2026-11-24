import { createMemo, For } from "solid-js";

import { useNoindex, usePageTitle } from "../lib/head.ts";
import { collectionsQuery } from "../lib/queries.ts";

const CollectionIndex = () => {
  usePageTitle(() => "Koleksi");
  useNoindex();
  const collections = createMemo(async () => await collectionsQuery());

  return (
    <main>
      <h1>Koleksi</h1>
      <ul>
        <For each={collections()}>
          {(collection) => (
            <li>
              <a href={collection.u}>{collection.name}</a>
              {collection.named && collection.t !== collection.name && (
                <p>{collection.t}</p>
              )}
            </li>
          )}
        </For>
      </ul>
    </main>
  );
};

export default CollectionIndex;
