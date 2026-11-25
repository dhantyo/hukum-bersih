import * as stylex from "@stylexjs/stylex";
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
import { panel } from "../styles/panel.ts";
import { color, media, size, space } from "../styles/tokens.stylex.ts";

type Version = CollectionVersion["versions"][number];

const OPEN = ":is([data-open])";
const HOVERED = stylex.when.ancestor(":hover");

const styles = stylex.create({
  trigger: {
    borderWidth: 0,
    gap: space.s2,
    paddingBlock: 0,
    paddingInline: 0,
    alignItems: "baseline",
    backgroundColor: "transparent",
    color: "inherit",
    cursor: "pointer",
    display: "flex",
    fontFamily: "inherit",
    inlineSize: "100%",
    marginBlockEnd: space.s2,
    outlineColor: color.link,
    outlineOffset: { default: null, ":focus-visible": 2 },
    outlineStyle: { default: null, ":focus-visible": "solid" },
    outlineWidth: { default: null, ":focus-visible": 3 },
    textAlign: "start",
    "::after": {
      alignSelf: "center",
      blockSize: 6,
      borderBlockEndColor: color.textMuted,
      borderBlockEndStyle: "solid",
      borderBlockEndWidth: 1.6,
      borderInlineEndColor: color.textMuted,
      borderInlineEndStyle: "solid",
      borderInlineEndWidth: 1.6,
      content: '""',
      inlineSize: 6,
      marginInlineStart: "auto",
      transform: { [OPEN]: "rotate(-135deg)", default: "rotate(45deg)" },
    },
  },
  title: { margin: 0 },
  count: { color: color.textMuted, fontSize: size.xs },
  list: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    position: "relative",
    "::before": {
      backgroundColor: color.line,
      content: '""',
      inlineSize: 1,
      insetInlineStart: 4,
      position: "absolute",
      bottom: space.s2,
      top: space.s2,
    },
  },
  row: {
    paddingBlock: space.s1,
    paddingInlineStart: space.s5,
    position: "relative",
  },
  here: {
    borderRadius: size.radius,
    backgroundColor: color.linkBackground,
    marginInlineStart: `calc(-1 * ${space.s1})`,
    paddingInlineStart: `calc(${space.s5} + ${space.s1})`,
  },
  dot: {
    borderRadius: "50%",
    backgroundColor: color.gone,
    blockSize: 9,
    boxShadow: `0 0 0 3px ${color.background}`,
    inlineSize: 9,
    insetInlineStart: 0,
    position: "absolute",
    top: `calc(${space.s1} + 0.35em)`,
  },
  dotNow: { backgroundColor: color.ok },
  dotMissing: {
    borderColor: color.gone,
    borderStyle: "dashed",
    borderWidth: 1,
    backgroundColor: color.background,
  },
  dotHere: { insetInlineStart: space.s1 },
  entry: {
    borderRadius: size.radius,
    paddingBlock: { default: null, [media.touch]: space.s2 },
    textDecoration: "none",
    color: color.text,
    display: "grid",
  },
  when: {
    color: color.textMuted,
    fontSize: size.xs,
    fontVariantNumeric: "tabular-nums",
  },
  what: {
    textDecoration: { [HOVERED]: "underline", default: null },
    color: { [HOVERED]: color.link, default: null },
    fontWeight: 600,
  },
  whatHere: { color: color.link },
  whatMissing: { color: color.textMuted, fontWeight: 400 },
  state: { color: color.ok, fontWeight: 400 },
  sub: { color: color.textMuted, display: "block", fontSize: size.xs },
});

const whenText = (version: Version) => {
  if (isPresent(version.date)) {
    return tanggal(version.date);
  }

  return version.missing ? "—" : "tanggal tidak diketahui";
};

const dotClass = (version: Version, here: boolean) =>
  css(
    styles.dot,
    version.inForce && styles.dotNow,
    version.missing && styles.dotMissing,
    here && styles.dotHere
  );

const VersionName = (props: { version: Version; here: boolean }) => (
  <>
    <span class={css(styles.when)}>{whenText(props.version)}</span>
    <span
      class={css(
        styles.what,
        props.here && styles.whatHere,
        props.version.missing && styles.whatMissing
      )}
    >
      {props.version.label}
      {props.version.inForce && (
        <span class={css(styles.state)}> · berlaku</span>
      )}
    </span>
  </>
);

const VersionRow = (props: { version: Version; current: string }) => {
  const here = () => props.version.href === props.current;

  return (
    <li class={css(styles.row, here() && styles.here)}>
      <span class={dotClass(props.version, here())} aria-hidden="true" />
      {isPresent(props.version.href) && !here() ? (
        <a
          class={css(linkStyles.base, styles.entry, stylex.defaultMarker())}
          href={props.version.href}
        >
          <VersionName version={props.version} here={false} />
        </a>
      ) : (
        <span
          class={css(styles.entry)}
          aria-current={here() ? "page" : undefined}
        >
          <VersionName version={props.version} here={here()} />
        </span>
      )}
      {isPresent(props.version.sub) && (
        <span class={css(styles.sub)}>{props.version.sub}</span>
      )}
    </li>
  );
};

/** The "Versi" list of the side panel: every version of the family, the one on screen marked. */
export const CollectionVersions = (props: {
  versions: CollectionVersion["versions"];
  current: string;
  comparable: boolean;
}) => (
  <Collapsible class={css(panel.block)} defaultOpen>
    <CollapsibleTrigger class={css(styles.trigger)}>
      <span class={css(panel.title, styles.title)}>Versi</span>
      <span class={css(styles.count)}>
        {props.versions.filter((row) => !row.missing).length}
      </span>
    </CollapsibleTrigger>
    <CollapsiblePanel>
      <ol class={css(styles.list)} aria-label="Versi">
        <For each={props.versions}>
          {(version) => (
            <VersionRow version={version} current={props.current} />
          )}
        </For>
      </ol>
      {props.comparable && (
        <p class={css(panel.note)}>
          <a class={css(linkStyles.base)} href="#banding" target="_self">
            Bandingkan versi
          </a>
        </p>
      )}
      <p class={css(panel.note)}>
        Versi gabungan disusun otomatis dari teks asli dan undang-undang
        perubahannya; bukan teks konsolidasi resmi.
      </p>
    </CollapsiblePanel>
  </Collapsible>
);
