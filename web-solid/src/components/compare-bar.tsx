import { useLocation, useNavigate } from "@solidjs/router";
import type { JSX } from "@solidjs/web";
import * as stylex from "@stylexjs/stylex";
import { createSignal, For, Show } from "solid-js";

import type { VersionChoice } from "../lib/compare.ts";
import { css } from "../styles/css.ts";
import { headerOffset } from "../styles/header-offset.stylex.ts";
import { linkStyles } from "../styles/link.ts";
import { motion } from "../styles/motion.stylex.ts";
import { color, font, shadow, size, space } from "../styles/tokens.stylex.ts";
import { VersionPicker } from "./collection-version-picker.tsx";
import { Grip, Handle, Root, SlidingColumn } from "./column-parts.tsx";
import { Legend } from "./compare-block.tsx";

const GRABBED = ":is([data-grabbed])";
const NO_SCRIPT = "@media (scripting: none)";
const SCRIPTED = "@media (scripting: enabled)";
const MIN_COLUMNS = 2;
const SEPARATOR = ",";

const styles = stylex.create({
  root: {
    paddingBlock: `${space.s3} ${space.s2}`,
    fontFamily: font.ui,
    fontSize: size.sm,
    marginBlockEnd: space.s5,
  },
  sticky: {
    backgroundColor: color.background,
    borderBlockEndColor: color.line,
    borderBlockEndStyle: "solid",
    borderBlockEndWidth: 1,
    position: { default: "sticky", "@media (max-width: 960px)": "static" },
    zIndex: 4,
    top: headerOffset.shown,
  },
  top: {
    gap: `${space.s1} ${space.s4}`,
    alignItems: "center",
    display: "flex",
    flexWrap: "wrap",
    marginBlockEnd: space.s2,
  },
  title: { margin: 0, fontSize: size.base, fontWeight: 600 },
  summary: { color: color.textMuted },
  only: {
    gap: space.s1,
    alignItems: "center",
    display: "inline-flex",
    marginInlineStart: "auto",
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
  bar: {
    padding: space.s3,
    borderColor: color.line,
    borderRadius: size.radiusMd,
    borderStyle: "solid",
    borderWidth: 1,
    gap: space.s2,
    alignItems: "center",
    backgroundColor: color.backgroundSubtle,
    display: "flex",
    flexWrap: "wrap",
  },
  slots: {
    gap: space.s2,
    alignItems: "center",
    display: "flex",
    flexWrap: "wrap",
  },
  slot: {
    padding: space.s1,
    borderColor: color.lineStrong,
    borderRadius: size.radius,
    borderStyle: "solid",
    borderWidth: 1,
    gap: space.s1,
    transition: {
      default: motion.liftTransition,
      [motion.reduced]: "none",
    },
    alignItems: "center",
    backgroundColor: color.background,
    boxShadow: { [GRABBED]: shadow.pop, default: null },
    display: "flex",
    minBlockSize: size.tap,
    position: "relative",
    scale: { [GRABBED]: 1.04, default: 1 },
    transform: {
      [GRABBED]: "translate(var(--drag-x, 0), var(--drag-y, 0))",
      default: null,
    },
    userSelect: "none",
    zIndex: { [GRABBED]: 3, default: null },
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
    display: { [NO_SCRIPT]: "none", default: "grid" },
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
    blockSize: size.tap,
    color: { default: color.textMuted, ":hover": color.delText },
    display: "grid",
    fontSize: size.lg,
    inlineSize: size.tap,
  },
  add: {
    borderColor: color.link,
    borderRadius: size.radius,
    borderStyle: "dashed",
    borderWidth: 1,
    paddingInline: space.s3,
    textDecoration: "none",
    alignItems: "center",
    display: "inline-flex",
    fontSize: size.sm,
    fontWeight: 600,
    minBlockSize: size.tap,
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

/** The address for a choice of columns, as a person would type it: `?v=a,b,c`, then `&pasal=5`
 * when a filter is set. */
export const columnsHref = (ids: string[], pasal = "") => {
  const query = new URLSearchParams({ v: ids.join(SEPARATOR) });

  if (pasal !== "") {
    query.set("pasal", pasal);
  }

  return `?${query.toString().replaceAll("%2C", SEPARATOR)}`;
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
    navigate(`${location.pathname}${props.href(ids)}`);
  };

  const without = (index: number) =>
    props.ids.filter((_id, position) => position !== index);

  const addition = () => nextVersion(props.versions, props.ids);

  return (
    <div class={css(styles.bar)}>
      <Root
        class={css(styles.slots)}
        aria-label="Versi yang dibandingkan"
        orientation="grid"
        value={order()}
        labels={labels()}
        onValueChange={(next) => {
          setOrder(next);

          setTimeout(() => {
            open(next.map(idOf));
          }, 0);
        }}
      >
        {(state) => (
          <For each={state.order}>
            {(key, index) => (
              <SlidingColumn
                slot={key}
                order={state.order.join(SEPARATOR)}
                versions={props.ids.join(SEPARATOR)}
                class={css(styles.slot)}
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
                <Show when={props.ids.length > MIN_COLUMNS}>
                  <a
                    class={css(linkStyles.base, styles.remove)}
                    href={props.href(without(keys().indexOf(key)))}
                    aria-label={`Hapus kolom ${citeOf(idOf(key))}`}
                    title="Hapus kolom"
                  >
                    ×
                  </a>
                </Show>
              </SlidingColumn>
            )}
          </For>
        )}
      </Root>
      <Show when={addition()}>
        {(next) => (
          <a
            class={css(linkStyles.base, styles.add)}
            href={props.href([...props.ids, next().id])}
          >
            + Tambah versi
          </a>
        )}
      </Show>
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
}) => (
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
      <Show when={props.onlyChanged}>
        <label class={css(styles.only)}>
          <input type="checkbox" data-cmp-only class={css(styles.check)} />
          Yang berubah saja
        </label>
      </Show>
      <Show when={props.closable}>
        <a class={css(linkStyles.base, styles.close)} href="./" target="_self">
          Tutup
        </a>
      </Show>
    </div>
    <form method="get" action={props.action}>
      <Columns versions={props.versions} ids={props.ids} href={props.href} />
      {props.children}
      <button type="submit" class={css(styles.submit)}>
        Bandingkan
      </button>
    </form>
    <Legend />
  </section>
);
