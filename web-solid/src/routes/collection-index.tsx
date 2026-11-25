import { createMemo, For } from "solid-js";

import { useNoindex, usePageTitle } from "../lib/head.ts";
import { collectionsQuery } from "../lib/queries.ts";
import { linkClass } from "../styles/link.ts";

const amendedText = (count: number) => `diubah ${count}×`;

const CollectionIndex = () => {
  usePageTitle(() => "Koleksi");
  useNoindex();
  const collections = createMemo(async () => await collectionsQuery());
  const named = () => collections().filter((collection) => collection.named);

  const other = () =>
    collections()
      .filter((collection) => !collection.named)
      .toSorted((first, second) => second.year - first.year);

  return (
    <main>
      <h1>Koleksi</h1>
      <p>
        Satu koleksi berisi undang-undang pokok beserta semua undang-undang yang
        mengubahnya, dan undang-undang yang digantikannya.
      </p>
      <h2>Dengan nama singkat</h2>
      <ul>
        <For each={named()}>
          {(collection) => (
            <li>
              <a class={linkClass} href={collection.u}>
                <strong>{collection.name}</strong>
                <span> {collection.t}</span>
                <span>
                  {" "}
                  {collection.cite} · {collection.laws} undang-undang
                  {collection.k > 0 && ` · ${amendedText(collection.k)}`}
                </span>
              </a>
            </li>
          )}
        </For>
      </ul>
      <h2>Undang-undang lain yang pernah diubah</h2>
      <ul>
        <For each={other()}>
          {(collection) => (
            <li>
              <a class={linkClass} href={collection.u}>
                {collection.name}
              </a>{" "}
              <small>
                {collection.cite} · {amendedText(collection.k)}
              </small>
            </li>
          )}
        </For>
      </ul>
    </main>
  );
};

export default CollectionIndex;
