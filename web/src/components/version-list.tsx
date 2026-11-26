import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@ui-sdk/solid/collapsible";
import { For } from "solid-js";

import { tanggal } from "../lib/labels.ts";
import { isPresent } from "../lib/text.ts";
import { css } from "../styles/css.ts";
import { linkStyles } from "../styles/link.ts";
import { versionLink } from "../styles/markers.stylex.ts";
import { panel, versions } from "../styles/panel.ts";

export interface VersionItem {
  label: string;
  date: string | null;
  href?: string;
  sub?: string;
  missing: boolean;
  inForce: boolean;
  here: boolean;
  made?: boolean;
}

const whenText = (item: VersionItem) => {
  if (isPresent(item.date)) {
    return tanggal(item.date);
  }

  return item.missing ? "—" : "tanggal tidak diketahui";
};

const subText = (item: VersionItem) =>
  item.made === true ? `${item.sub ?? ""} · dibuat oleh UU ini` : item.sub;

const VersionName = (props: { item: VersionItem }) => (
  <>
    <span class={css(versions.when)}>{whenText(props.item)}</span>
    <span
      class={css(
        versions.what,
        props.item.here && versions.whatHere,
        props.item.missing && versions.whatMissing
      )}
    >
      {props.item.label}
      {props.item.inForce && (
        <span class={css(versions.state)}> · berlaku</span>
      )}
    </span>
    {isPresent(subText(props.item)) && (
      <span class={css(versions.sub)}>{subText(props.item)}</span>
    )}
  </>
);

const dotClass = (item: VersionItem) =>
  css(
    versions.dot,
    item.inForce && versions.dotNow,
    item.missing && versions.dotMissing,
    item.here && versions.dotHere
  );

const VersionRow = (props: { item: VersionItem }) => (
  <li class={css(versions.row, props.item.here && versions.rowHere)}>
    <span class={dotClass(props.item)} aria-hidden="true" />
    {isPresent(props.item.href) && !props.item.here ? (
      <a
        class={css(linkStyles.base, versions.entry, versionLink)}
        href={props.item.href}
      >
        <VersionName item={props.item} />
      </a>
    ) : (
      <span
        class={css(versions.entry)}
        aria-current={props.item.here ? "page" : undefined}
      >
        <VersionName item={props.item} />
      </span>
    )}
  </li>
);

/** The "Versi" block of the side panel: every version of a family on a line, the one on screen marked. */
export const VersionList = (props: {
  items: VersionItem[];
  compareHref?: string;
}) => (
  <Collapsible class={css(panel.block)} defaultOpen>
    <CollapsibleTrigger class={css(versions.trigger)}>
      <span class={css(panel.title)}>Versi</span>
      <span class={css(versions.count)}>
        {props.items.filter((item) => !item.missing).length}
      </span>
    </CollapsibleTrigger>
    <CollapsiblePanel>
      <ol class={css(versions.list)} aria-label="Versi">
        <For each={props.items}>{(item) => <VersionRow item={item} />}</For>
      </ol>
      {isPresent(props.compareHref) && (
        <a
          class={css(linkStyles.base, versions.compare)}
          href={props.compareHref}
        >
          Bandingkan versi
        </a>
      )}
      <p class={css(panel.note)}>
        Versi gabungan disusun otomatis dari teks asli dan undang-undang
        perubahannya; bukan teks konsolidasi resmi.
      </p>
    </CollapsiblePanel>
  </Collapsible>
);
