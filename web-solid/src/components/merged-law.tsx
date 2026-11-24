import { For } from "solid-js";

import { pasalKey } from "../../../web/src/lib/display.ts";
import { isPresent } from "../lib/text.ts";
import type { CollectionVersion } from "../server/records/collection-version.ts";
import { LawText } from "./law-text.tsx";

const Completeness = (props: { version: CollectionVersion }) => (
  <ul>
    {props.version.missing > 0 && (
      <li>{props.version.missing} perubahan sebelumnya belum tersedia.</li>
    )}
    <For each={props.version.unreadable}>
      {(article) => (
        <li>
          Teks baru <a href={`#pasal-${pasalKey(article)}`}>Pasal {article}</a>{" "}
          belum terbaca. Teks sebelumnya ditampilkan.
        </li>
      )}
    </For>
    <For each={props.version.unapplied}>
      {(instruction) => <li>Ketentuan belum diterapkan: “{instruction}”</li>}
    </For>
  </ul>
);

export const MergedLaw = (props: { version: CollectionVersion }) => (
  <div class="law-reader">
    <aside aria-label="Tentang teks gabungan" data-pagefind-ignore>
      <p>
        Teks gabungan per {props.version.date ?? "tanggal tidak diketahui"},
        disusun otomatis.
      </p>
      <p>
        Gabungan{" "}
        <a href={props.version.base.href}>{props.version.base.label}</a>
        {" dan perubahannya sampai "}
        {props.version.amendments.join(" dan ")}. Bukan teks konsolidasi resmi.
      </p>
      {props.version.incomplete && (
        <>
          <p>Belum lengkap:</p>
          <Completeness version={props.version} />
        </>
      )}
      {props.version.text.penjelasan.length > 0 && (
        <p>Penjelasan berikut berasal dari teks asli.</p>
      )}
    </aside>
    <nav aria-label="Versi" data-pagefind-ignore>
      <h2>Versi</h2>
      <ul>
        <For each={props.version.versions}>
          {(version) => (
            <li>
              {isPresent(version.href) ? (
                <a href={version.href}>{version.label}</a>
              ) : (
                version.label
              )}
              {isPresent(version.date) ? ` · ${version.date}` : ""}
              {isPresent(version.sub) ? ` · ${version.sub}` : ""}
            </li>
          )}
        </For>
      </ul>
    </nav>
    <LawText text={props.version.text} notes={props.version.notes} />
  </div>
);
