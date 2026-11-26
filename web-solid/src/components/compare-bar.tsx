import { useLocation, useNavigate } from "@solidjs/router";
import type { JSX } from "@solidjs/web";
import * as stylex from "@stylexjs/stylex";
import { createEffect, createSignal, For, Show } from "solid-js";

import { GLIDE_MS } from "../lib/column-shift.ts";
import type { VersionChoice } from "../lib/compare.ts";
import { createTextSlide } from "../lib/text-slide.ts";
import { pillRange } from "../styles/column-shift.stylex.ts";
import { css } from "../styles/css.ts";
import { headerOffset } from "../styles/header-offset.stylex.ts";
import { linkStyles } from "../styles/link.ts";
import { motion } from "../styles/motion.stylex.ts";
import {
  color,
  font,
  media,
  shadow,
  size,
  space,
} from "../styles/tokens.stylex.ts";
import { VersionPicker } from "./collection-version-picker.tsx";
import { Column, Grip, Handle, Root } from "./column-parts.tsx";
import { Legend } from "./compare-block.tsx";

const GRABBED = ":is([data-grabbed])";
const NO_SCRIPT = "@media (scripting: none)";
const SCRIPTED = "@media (scripting: enabled)";
const MIN_COLUMNS = 2;
const SEPARATOR = ",";
const RAIL_THICKNESS = "2px";

const styles = stylex.create({
  root: {
    paddingBlock: `${space.s3} ${space.s2}`,
    backgroundColor: color.background,
    borderBlockEndColor: color.line,
    borderBlockEndStyle: "solid",
    borderBlockEndWidth: 1,
    fontFamily: font.ui,
    fontSize: size.sm,
    marginBlockEnd: space.s5,
  },
  sticky: {
    position: { default: "sticky", [media.tablet]: "static" },
    zIndex: 4,
    top: headerOffset.shown,
  },
  top: {
    gap: `${space.s1} ${space.s4}`,
    alignItems: "center",
    display: "flex",
    flexWrap: "wrap",
  },
  title: { margin: 0, fontSize: size.base, fontWeight: 600 },
  summary: { color: color.textMuted },
  actions: {
    gap: `${space.s1} ${space.s4}`,
    alignItems: "center",
    display: "flex",
    flexWrap: "wrap",
    marginInlineStart: { default: "auto", [media.tablet]: 0 },
  },
  only: {
    gap: space.s1,
    alignItems: "center",
    display: "inline-flex",
  },
  check: { accentColor: color.link },
  close: {
    font: "inherit",
    borderColor: color.lineStrong,
    borderRadius: size.radius,
    borderStyle: "solid",
    borderWidth: 1,
    paddingBlock: space.s1,
    paddingInline: space.s3,
    textDecoration: "none",
    alignItems: "center",
    display: "inline-flex",
    minBlockSize: space.s6,
  },
  add: {
    borderColor: color.link,
    borderRadius: size.radius,
    borderStyle: "dashed",
    borderWidth: 1,
    paddingBlock: space.s1,
    paddingInline: space.s3,
    textDecoration: "none",
    alignItems: "center",
    display: "inline-flex",
    fontWeight: 600,
    minBlockSize: space.s6,
  },
  chooser: {
    marginBlockStart: space.s3,
    position: "relative",
  },
  slots: {
    alignItems: "center",
    display: "grid",
    gridAutoColumns: "minmax(0, 1fr)",
    gridAutoFlow: "column",
  },
  stacked: {
    gap: space.s2,
    gridAutoFlow: { default: "column", [media.phone]: "row" },
  },
  stackedRail: { display: { default: "grid", [media.phone]: "none" } },
  stackedSlot: { justifySelf: { default: "center", [media.phone]: "stretch" } },
  slot: {
    borderColor: color.lineStrong,
    borderRadius: size.radiusMd,
    borderStyle: "solid",
    borderWidth: 1,
    gap: space.s1,
    marginInline: { default: space.s5, [media.tablet]: space.s1 },
    paddingBlock: space.hairline,
    paddingInline: `${space.s1} ${space.s2}`,
    transition: {
      default: motion.liftTransition,
      [motion.reduced]: "none",
    },
    alignItems: "center",
    backgroundColor: color.background,
    boxShadow: { [GRABBED]: shadow.pop, default: shadow.sm },
    display: "flex",
    justifySelf: "center",
    maxInlineSize: "100%",
    minInlineSize: 0,
    position: "relative",
    scale: { [GRABBED]: 1.04, default: 1 },
    transform: {
      [GRABBED]: `translate(clamp(${pillRange.least}, var(--drag-x, 0px), ${pillRange.most}), 0)`,
      default: null,
    },
    userSelect: "none",
    zIndex: { [GRABBED]: 3, default: 1 },
  },
  handle: {
    padding: 0,
    borderRadius: size.radius,
    borderWidth: 0,
    placeItems: "center",
    backgroundColor: "transparent",
    blockSize: space.s6,
    color: color.textMuted,
    cursor: { default: "grab", ":active": "grabbing" },
    display: {
      [NO_SCRIPT]: "none",
      default: "grid",
      [media.tablet]: "none",
    },
    flexShrink: 0,
    inlineSize: space.s4,
    outlineColor: color.link,
    outlineOffset: 2,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: 3,
    touchAction: "none",
  },
  remove: {
    borderRadius: size.radius,
    placeItems: "center",
    textDecoration: "none",
    backgroundColor: { default: null, ":hover": color.delBackground },
    blockSize: space.s6,
    color: { default: color.textMuted, ":hover": color.delText },
    display: "grid",
    flexShrink: 0,
    fontSize: size.lg,
    inlineSize: space.s6,
  },
  rail: {
    inset: 0,
    alignItems: "center",
    display: "grid",
    gridAutoColumns: "minmax(0, 1fr)",
    gridAutoFlow: "column",
    pointerEvents: "none",
    position: "absolute",
    zIndex: 0,
  },
  segment: {
    backgroundColor: color.lineStrong,
    blockSize: RAIL_THICKNESS,
    position: "relative",
  },
  segmentFirst: { marginInlineStart: "50%" },
  segmentLast: { marginInlineEnd: "50%" },
  swap: {
    borderColor: {
      default: color.lineStrong,
      ":focus-visible": color.link,
      ":hover": color.link,
    },
    borderRadius: "50%",
    borderStyle: "solid",
    borderWidth: 1,
    placeItems: "center",
    textDecoration: "none",
    backgroundColor: color.background,
    blockSize: space.s6,
    color: { default: color.textMuted, ":hover": color.link },
    display: { default: "grid", [media.tablet]: "none" },
    inlineSize: space.s6,
    insetBlockStart: "50%",
    insetInlineEnd: 0,
    outlineColor: color.link,
    outlineOffset: 2,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: 3,
    pointerEvents: "auto",
    position: "absolute",
    transform: "translate(50%, -50%)",
    zIndex: 2,
  },
  submit: {
    font: "inherit",
    borderColor: color.lineStrong,
    borderRadius: size.radius,
    borderStyle: "solid",
    borderWidth: 1,
    paddingInline: space.s4,
    backgroundColor: color.background,
    color: color.link,
    cursor: "pointer",
    display: { [SCRIPTED]: "none", default: "block" },
    marginBlockStart: space.s2,
    minBlockSize: size.tap,
  },
});

const columnKeys = (ids: string[]) =>
  ids.map((id, index) => (ids.indexOf(id) === index ? id : `${id}~${index}`));

const nextVersion = (versions: VersionChoice[], ids: string[]) => {
  const last = versions.findIndex((entry) => entry.id === ids.at(-1));

  return (
    versions.find((entry, index) => index > last && !ids.includes(entry.id)) ??
    versions.find((entry) => !ids.includes(entry.id))
  );
};

const swapped = <Item,>(items: Item[], index: number) =>
  items.map((item, position) => {
    if (position === index) {
      return items[index + 1];
    }

    return position === index + 1 ? items[index] : item;
  });

/** The address for a choice of columns, as a person would type it: `?v=a,b,c`, then `&pasal=5`
 * when a filter is set. */
export const columnsHref = (ids: string[], pasal = "") => {
  const query = new URLSearchParams({ v: ids.join(SEPARATOR) });

  if (pasal !== "") {
    query.set("pasal", pasal);
  }

  return `?${query.toString().replaceAll("%2C", SEPARATOR)}`;
};

const SwapIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path
      d="M3 6h10m0 0-2.5-2.5M13 6l-2.5 2.5M13 10H3m0 0 2.5-2.5M3 10l2.5 2.5"
      fill="none"
      stroke="currentColor"
      stroke-width="1.4"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
);

const segmentStyle = (index: number, count: number) => [
  styles.segment,
  index === 0 && styles.segmentFirst,
  index === count - 1 && styles.segmentLast,
];

const OrderWatch = (props: {
  order: readonly string[];
  from: readonly string[];
  onOrder: (order: readonly string[], from: readonly string[]) => void;
}) => {
  createEffect(
    () => ({ order: [...props.order], from: [...props.from] }),
    ({ order, from }) => {
      props.onOrder(order, from);
    }
  );

  return null;
};

const Columns = (props: {
  versions: VersionChoice[];
  ids: string[];
  href: (ids: string[]) => string;
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const keys = () => columnKeys(props.ids);
  const [order, setOrder] = createSignal<string[]>(() => keys());

  const idOf = (key: string) => props.ids[keys().indexOf(key)] ?? key;

  const citeOf = (id: string) =>
    props.versions.find((entry) => entry.id === id)?.cite ?? id;

  const labels = () =>
    Object.fromEntries(keys().map((key) => [key, citeOf(idOf(key))]));

  const open = (ids: string[]) => {
    navigate(`${location.pathname}${props.href(ids)}`, { scroll: false });
  };

  let chooser: HTMLElement | undefined;

  const slide = createTextSlide(keys, () => chooser);

  createEffect(
    () => props.ids.join(SEPARATOR),
    () => {
      slide.reset();
    }
  );

  const reorder = (next: string[]) => {
    setOrder(next);

    setTimeout(() => {
      open(next.map(idOf));
    }, GLIDE_MS);
  };

  const crowded = () => props.ids.length > MIN_COLUMNS;

  const without = (index: number) =>
    props.ids.filter((_id, position) => position !== index);

  return (
    <div
      class={css(styles.chooser)}
      ref={(element) => {
        chooser = element;
        element.addEventListener("pointerdown", slide.pointerDown, true);
      }}
    >
      <Root
        class={css(styles.slots, crowded() && styles.stacked)}
        aria-label="Versi yang dibandingkan"
        orientation="horizontal"
        value={order()}
        labels={labels()}
        onValueChange={reorder}
      >
        {(state) => (
          <>
            <OrderWatch
              order={state.order}
              from={keys()}
              onOrder={slide.follow}
            />
            <For each={state.order}>
              {(key, index) => (
                <Column
                  value={key}
                  data-version={key}
                  class={css(styles.slot, crowded() && styles.stackedSlot)}
                >
                  <Handle
                    value={key}
                    class={css(styles.handle)}
                    aria-label={`Pindahkan kolom ${citeOf(idOf(key))}`}
                    title="Geser untuk mengubah urutan kolom"
                  >
                    <Grip />
                  </Handle>
                  <VersionPicker
                    name="v"
                    label={`Versi kolom ${index() + 1}`}
                    versions={props.versions}
                    value={idOf(key)}
                    onPick={(id) => {
                      open(
                        props.ids.map((current, position) =>
                          position === keys().indexOf(key) ? id : current
                        )
                      );
                    }}
                  />
                  <Show when={crowded()}>
                    <a
                      class={css(linkStyles.base, styles.remove)}
                      href={props.href(without(keys().indexOf(key)))}
                      aria-label={`Hapus kolom ${citeOf(idOf(key))}`}
                      title="Hapus kolom"
                      noscroll
                    >
                      ×
                    </a>
                  </Show>
                </Column>
              )}
            </For>
          </>
        )}
      </Root>
      <div class={css(styles.rail, crowded() && styles.stackedRail)}>
        <For each={props.ids}>
          {(_id, index) => (
            <div class={css(segmentStyle(index(), props.ids.length))}>
              <Show when={index() < props.ids.length - 1}>
                <a
                  class={css(linkStyles.base, styles.swap)}
                  href={props.href(swapped(props.ids, index()))}
                  aria-label={`Tukar kolom ${citeOf(idOf(order()[index()] ?? ""))} dan ${citeOf(idOf(order()[index() + 1] ?? ""))}`}
                  title="Tukar kolom"
                  noscroll
                  target="_self"
                  onClick={(event) => {
                    event.preventDefault();
                    reorder(swapped(order(), index()));
                  }}
                >
                  <SwapIcon />
                </a>
              </Show>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};

/**
 * The bar of every comparison: its title and summary, the chooser of versions, what the marks
 * mean. `children` are more fields of the same GET form (a filter, quick choices). `action` is
 * where the form without a script goes; `href` is the address of a choice of columns.
 */
export const CompareBar = (props: {
  versions: VersionChoice[];
  ids: string[];
  href: (ids: string[]) => string;
  action: string;
  summary: string;
  /** Pinned under the site header while the text scrolls (the reading view). */
  sticky?: boolean;
  /** Offers to hide the pasal that did not change (a comparison inside the text). */
  onlyChanged?: boolean;
  /** Offers a way back to the page without the comparison. */
  closable?: boolean;
  children?: JSX.Element;
}) => {
  const addition = () => nextVersion(props.versions, props.ids);

  return (
    <section
      class={css(styles.root, props.sticky === true && styles.sticky)}
      aria-labelledby="cmp-title"
      data-cmp-bar
    >
      <div class={css(styles.top)}>
        <h2 id="cmp-title" class={css(styles.title)}>
          Bandingkan versi
        </h2>
        <output class={css(styles.summary)}>{props.summary}</output>
        <div class={css(styles.actions)}>
          <Show when={props.onlyChanged}>
            <label class={css(styles.only)}>
              <input type="checkbox" data-cmp-only class={css(styles.check)} />
              Yang berubah saja
            </label>
          </Show>
          <Show when={addition()}>
            {(next) => (
              <a
                class={css(linkStyles.base, styles.add)}
                noscroll
                href={props.href([...props.ids, next().id])}
              >
                + Tambah versi
              </a>
            )}
          </Show>
          <Show when={props.closable}>
            <a
              class={css(linkStyles.base, styles.close)}
              href="./"
              target="_self"
            >
              Tutup
            </a>
          </Show>
        </div>
      </div>
      <form method="get" action={props.action}>
        <Columns versions={props.versions} ids={props.ids} href={props.href} />
        <Legend />
        {props.children}
        <button type="submit" class={css(styles.submit)}>
          Bandingkan
        </button>
      </form>
    </section>
  );
};
