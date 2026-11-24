import { For, Show } from "solid-js";

import { pasalKey } from "../../../web/src/lib/display.ts";
import { tanggal } from "../../../web/src/lib/labels.ts";
import { isPresent } from "../lib/text.ts";
import type { CollectionVersion } from "../server/records/collection-version.ts";

type Citation = CollectionVersion["amendments"][number];

const CitationLink = (props: { citation: Citation }) => (
  <Show when={props.citation.href} fallback={props.citation.label} keyed>
    {(href) => <a href={href}>{props.citation.label}</a>}
  </Show>
);

const Completeness = (props: { version: CollectionVersion }) => (
  <ul>
    {props.version.missing > 0 && (
      <li>
        {props.version.missing} perubahan sebelumnya belum tersedia di sini;
        pasal yang diubahnya mungkin belum sesuai.
      </li>
    )}
    {props.version.unreadable.length > 0 && (
      <li>
        Teks baru {props.version.unreadable.length} pasal belum terbaca, jadi
        yang ditampilkan teks sebelumnya:{" "}
        <For each={props.version.unreadable}>
          {(article, index) => (
            <>
              {index() > 0 && ", "}
              <a href={`#pasal-${pasalKey(article)}`} target="_self">
                Pasal {article}
              </a>
            </>
          )}
        </For>
        .
      </li>
    )}
    <For each={props.version.unapplied}>
      {(entry) => (
        <li>
          Ketentuan{" "}
          {entry.instruction === null ? "" : `angka ${entry.instruction} `}
          <CitationLink citation={entry.by} /> belum diterapkan: “{entry.header}
          ”
        </li>
      )}
    </For>
  </ul>
);

export const MergedBanner = (props: { version: CollectionVersion }) => (
  <aside aria-label="Tentang teks gabungan" data-pagefind-ignore>
    <p>
      Teks gabungan per{" "}
      {isPresent(props.version.date)
        ? tanggal(props.version.date)
        : "tanggal tidak diketahui"}
      , disusun otomatis.
    </p>
    <p>
      Gabungan <a href={props.version.base.href}>{props.version.base.label}</a>{" "}
      dan perubahannya sampai{" "}
      <For each={props.version.amendments}>
        {(citation, index) => (
          <>
            {index() > 0 && " dan "}
            <CitationLink citation={citation} />
          </>
        )}
      </For>
      . Bukan teks konsolidasi resmi; teks asli setiap undang-undang ada di
      halamannya.
    </p>
    {props.version.incomplete && (
      <>
        <p>Belum lengkap:</p>
        <Completeness version={props.version} />
      </>
    )}
    {props.version.text.penjelasan.length > 0 && (
      <p>
        Penjelasan di bawah menurut teks asli {props.version.base.label};
        perubahan penjelasan belum digabung.
      </p>
    )}
  </aside>
);
