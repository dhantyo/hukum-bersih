import { For } from "solid-js";

import { tanggal } from "../../../web/src/lib/labels.ts";
import { isPresent } from "../lib/text.ts";
import type { CollectionVersion } from "../server/records/collection-version.ts";
import { linkClass } from "../styles/link.ts";

type Version = CollectionVersion["versions"][number];

const whenText = (version: Version) => {
  if (isPresent(version.date)) {
    return tanggal(version.date);
  }

  return version.missing ? "—" : "tanggal tidak diketahui";
};

const VersionName = (props: { version: Version }) => (
  <>
    <span>{whenText(props.version)}</span>{" "}
    <span>
      {props.version.label}
      {props.version.inForce && " · berlaku"}
    </span>
  </>
);

/** The "Versi" list of the side panel: every version of the family, the one on screen marked. */
export const CollectionVersions = (props: {
  versions: CollectionVersion["versions"];
  current: string;
  comparable: boolean;
}) => (
  <nav aria-label="Versi" data-pagefind-ignore>
    <h2>
      Versi <span>{props.versions.filter((row) => !row.missing).length}</span>
    </h2>
    <ol>
      <For each={props.versions}>
        {(version) => (
          <li>
            {isPresent(version.href) && version.href !== props.current ? (
              <a class={linkClass} href={version.href}>
                <VersionName version={version} />
              </a>
            ) : (
              <span
                aria-current={
                  version.href === props.current ? "page" : undefined
                }
              >
                <VersionName version={version} />
              </span>
            )}
            {isPresent(version.sub) && <small> {version.sub}</small>}
          </li>
        )}
      </For>
    </ol>
    {props.comparable && (
      <p>
        <a class={linkClass} href="#banding" target="_self">
          Bandingkan versi
        </a>
      </p>
    )}
    <p>
      Versi gabungan disusun otomatis dari teks asli dan undang-undang
      perubahannya; bukan teks konsolidasi resmi.
    </p>
  </nav>
);
