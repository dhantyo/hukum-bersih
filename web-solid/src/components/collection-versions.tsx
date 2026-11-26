import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@ui-sdk/solid/collapsible";
import { For } from "solid-js";

import { tanggal } from "../lib/labels.ts";
import { isPresent } from "../lib/text.ts";
import type { CollectionVersion } from "../server/records/collection-version.ts";
import { css } from "../styles/css.ts";
import { linkStyles } from "../styles/link.ts";
import { versionLink } from "../styles/markers.stylex.ts";
import { panel, versions } from "../styles/panel.ts";

type Version = CollectionVersion["versions"][number];

const whenText = (version: Version) => {
  if (isPresent(version.date)) {
    return tanggal(version.date);
  }

  return version.missing ? "—" : "tanggal tidak diketahui";
};

const VersionName = (props: { version: Version; here: boolean }) => (
  <>
    <span class={css(versions.when)}>{whenText(props.version)}</span>
    <span
      class={css(
        versions.what,
        props.here && versions.whatHere,
        props.version.missing && versions.whatMissing
      )}
    >
      {props.version.label}
      {props.version.inForce && (
        <span class={css(versions.state)}> · berlaku</span>
      )}
    </span>
    {isPresent(props.version.sub) && (
      <span class={css(versions.sub)}>{props.version.sub}</span>
    )}
  </>
);

const VersionRow = (props: { version: Version; current: string }) => {
  const here = () => props.version.href === props.current;

  return (
    <li>
      {isPresent(props.version.href) && !here() ? (
        <a
          class={css(linkStyles.base, versions.entry, versionLink)}
          href={props.version.href}
        >
          <VersionName version={props.version} here={false} />
        </a>
      ) : (
        <span
          class={css(versions.entry, here() && versions.entryHere)}
          aria-current={here() ? "page" : undefined}
        >
          <VersionName version={props.version} here={here()} />
        </span>
      )}
    </li>
  );
};

/** The "Versi" list of the side panel: every version of the family, the one on screen marked. */
export const CollectionVersions = (props: {
  versions: CollectionVersion["versions"];
  current: string;
  compareHref?: string;
}) => (
  <Collapsible class={css(panel.block)} defaultOpen>
    <CollapsibleTrigger class={css(versions.trigger)}>
      <span class={css(panel.title)}>Versi</span>
      <span class={css(versions.count)}>
        {props.versions.filter((row) => !row.missing).length}
      </span>
    </CollapsibleTrigger>
    <CollapsiblePanel>
      <ol class={css(panel.list)} aria-label="Versi">
        <For each={props.versions}>
          {(version) => (
            <VersionRow version={version} current={props.current} />
          )}
        </For>
      </ol>
      {isPresent(props.compareHref) && (
        <a
          class={css(linkStyles.base, versions.compare)}
          href={props.compareHref}
        >
          Bandingkan versi
        </a>
      )}
      <p class={css(panel.note, versions.noteIndent)}>
        Versi gabungan disusun otomatis dari teks asli dan undang-undang
        perubahannya; bukan teks konsolidasi resmi.
      </p>
    </CollapsiblePanel>
  </Collapsible>
);
