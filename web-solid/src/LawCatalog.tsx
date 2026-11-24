import { For } from 'solid-js';
import type { LawCatalogEntry } from './server/catalog';

export function LawCatalog(props: { laws: LawCatalogEntry[] }) {
  return <ul>
    <For each={props.laws}>{(law) => <li>
      <a href={law.u}>{law.s ?? (law.t || law.c)}</a>
      {' · '}{law.c}
    </li>}</For>
  </ul>;
}
