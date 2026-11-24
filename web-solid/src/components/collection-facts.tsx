import { For } from "solid-js";

import { isPresent } from "../lib/text.ts";
import type { CollectionVersion } from "../server/records/collection-version.ts";

/** The laws of the collection with the part each plays: base law, amendments, replaced laws. */
export const CollectionFacts = (props: {
  facts: CollectionVersion["facts"];
}) => (
  <section aria-label="Undang-undang" data-pagefind-ignore>
    <h2>Undang-undang</h2>
    <dl>
      <For each={props.facts}>
        {(fact) => (
          <>
            <dt>{fact.label}</dt>
            <dd>
              {isPresent(fact.href) ? (
                <a href={fact.href}>{fact.value}</a>
              ) : (
                fact.value
              )}
            </dd>
          </>
        )}
      </For>
    </dl>
  </section>
);
