import { For } from "solid-js";

import type { LawCatalogEntry } from "../server/records/catalog.ts";
import { linkClass } from "../styles/link.ts";

export const LawCatalog = (props: { laws: LawCatalogEntry[] }) => (
  <ul>
    <For each={props.laws}>
      {(law) => (
        <li>
          <a class={linkClass} href={law.u}>
            {law.s ?? (law.t === "" ? law.c : law.t)}
          </a>
          {" · "}
          {law.c}
        </li>
      )}
    </For>
  </ul>
);
