import { useLocation } from "@solidjs/router";
import * as stylex from "@stylexjs/stylex";
import { createMemo, For, onSettled, Show, useContext } from "solid-js";

import { followHeader } from "../lib/header-follow.ts";
import { slashed } from "../lib/paths.ts";
import { ReaderViewContext } from "../lib/reader-view.ts";
import { Router } from "../router.tsx";
import { css } from "../styles/css.ts";
import { headerOffset } from "../styles/header-offset.stylex.ts";
import { linkStyles } from "../styles/link.ts";
import { color, media, size, space } from "../styles/tokens.stylex.ts";
import { accessibility } from "../styles/visually-hidden.ts";
import { ReadingSettings } from "./reading-settings.tsx";

const COMPARING = ":has([data-cmp-bar])";
const FOLLOWING = ":is([data-mode])";
const FREE = ':is([data-mode="free"])';
const HIDDEN = ':is([data-mode="hidden"])';
const PINNED = ':is([data-mode="pinned"])';
const MOTION = "@media (prefers-reduced-motion: no-preference)";

const styles = stylex.create({
  skip: {
    padding: space.s2,
    backgroundColor: color.background,
    position: "absolute",
    zIndex: 10,
    left: {
      default: -999,
      ":focus": space.s4,
    },
    top: {
      default: 0,
      ":focus": space.s2,
    },
  },
  header: {
    insetInline: { [FOLLOWING]: 0, default: null },
    transition: {
      [MOTION]: {
        [HIDDEN]: "transform 0.24s ease-out",
        [PINNED]: "transform 0.24s ease-out",
        default: null,
      },
      default: null,
    },
    backgroundColor: color.background,
    blockSize: "calc-size(auto, round(up, size, 1px))",
    borderBlockEndColor: color.line,
    borderBlockEndStyle: "solid",
    borderBlockEndWidth: 1,
    position: {
      [FREE]: "absolute",
      [HIDDEN]: "fixed",
      [PINNED]: "fixed",
      default: null,
    },
    zIndex: { [FOLLOWING]: 15, default: null },
    top: { [FOLLOWING]: 0, default: null },
  },
  bar: {
    marginInline: "auto",
    paddingBlock: { default: 0, [media.tablet]: space.s3 },
    paddingInline: space.s4,
    alignItems: "center",
    boxSizing: "border-box",
    columnGap: space.s3,
    display: "flex",
    flexWrap: "wrap",
    rowGap: {
      default: space.s5,
      [media.tablet]: space.s3,
      [media.phone]: space.s2,
    },
    maxWidth: {
      default: size.page,
      [stylex.when.ancestor(COMPARING)]: size.pageWide,
    },
    minHeight: size.headerMin,
  },
  brand: {
    textDecoration: "none",
    color: color.text,
    flexBasis: { default: "auto", [media.phone]: "100%" },
    fontSize: size.lg,
    fontWeight: 700,
    letterSpacing: "-0.01em",
  },
  nav: { columnGap: space.s4, display: "flex", marginInlineEnd: space.s3 },
  link: {
    paddingBlock: space.s1,
    textDecoration: "none",
    borderBlockEndColor: {
      default: "transparent",
      ":hover": color.line,
    },
    borderBlockEndStyle: "solid",
    borderBlockEndWidth: 2,
    color: color.text,
    fontWeight: 500,
  },
  linkActive: {
    borderBlockEndColor: color.link,
    color: color.link,
  },
  search: {
    flexBasis: {
      default: size.search,
      [media.tablet]: "calc(100% - 4rem)",
    },
    flexGrow: { default: 0, [media.tablet]: 1 },
    flexShrink: 1,
    marginInlineStart: { default: "auto", [media.tablet]: 0 },
    order: { default: 0, [media.tablet]: 3 },
  },
  settings: {
    order: { default: 0, [media.tablet]: 4 },
  },
  settingsEnd: { marginInlineStart: "auto" },
  field: {
    font: "inherit",
    borderColor: color.lineStrong,
    borderRadius: size.radius,
    borderStyle: "solid",
    borderWidth: 1,
    paddingBlock: space.s2,
    paddingInline: space.s3,
    backgroundColor: {
      default: color.backgroundSubtle,
      ":focus": color.background,
    },
    boxSizing: "border-box",
    color: color.text,
    fontSize: size.sm,
    outlineColor: color.link,
    outlineOffset: { default: null, ":focus-visible": 2 },
    outlineStyle: { default: null, ":focus-visible": "solid" },
    outlineWidth: { default: null, ":focus-visible": 3 },
    width: "100%",
    "::placeholder": { color: color.textMuted },
  },
  form: { margin: 0 },
});

const TRAILING_SLASH = /\/$/u;

const sections = [
  { href: slashed(Router.paths.uu), label: "Peraturan" },
  { href: slashed(Router.paths.koleksi), label: "Koleksi" },
  { href: slashed(Router.paths.ruu), label: "RUU" },
  { href: slashed(Router.paths.tentang), label: "Tentang" },
];

const SectionLink = (props: { href: string; label: string }) => {
  const location = useLocation();

  const active = createMemo(() => {
    const section = props.href.replace(TRAILING_SLASH, "");

    return (
      location.pathname === section ||
      location.pathname.startsWith(`${section}/`)
    );
  });

  return (
    <a
      class={css(linkStyles.base, styles.link, active() && styles.linkActive)}
      href={props.href}
      aria-current={active() ? "page" : undefined}
    >
      {props.label}
    </a>
  );
};

/** The home page has its own search field, so the header drops its own. */
export const SiteHeader = (props: { pending: boolean }) => {
  const location = useLocation();
  const [readerText] = useContext(ReaderViewContext);
  const hasSearch = () => location.pathname !== Router.paths();
  let slot!: HTMLDivElement;
  let header!: HTMLElement;

  onSettled(() => followHeader(header, slot, headerOffset.shown));

  return (
    <>
      <a class={css(linkStyles.base, styles.skip)} href="#main">
        Langsung ke isi
      </a>
      <div ref={slot}>
        <header ref={header} class={css(styles.header)}>
          <div class={css(styles.bar)}>
            <a class={css(linkStyles.base, styles.brand)} href={Router.paths()}>
              Hukum Bersih
            </a>
            <nav class={css(styles.nav)} aria-label="Utama">
              <For each={sections}>
                {(section) => (
                  <SectionLink href={section.href} label={section.label} />
                )}
              </For>
            </nav>
            <Show when={hasSearch()}>
              <search class={css(styles.search)} aria-label="Cari cepat">
                <form
                  class={css(styles.form)}
                  action={slashed(Router.paths.cari)}
                  method="get"
                >
                  <label class={css(accessibility.visuallyHidden)} for="q">
                    Cari peraturan
                  </label>
                  <input
                    class={css(styles.field)}
                    id="q"
                    name="q"
                    type="search"
                    placeholder="Cari undang-undang, pasal, kata…"
                    autocomplete="off"
                  />
                </form>
              </search>
            </Show>
            <div
              class={css(styles.settings, !hasSearch() && styles.settingsEnd)}
            >
              <ReadingSettings text={readerText()} />
            </div>
          </div>
        </header>
      </div>
      <Show when={props.pending}>
        <output>Memuat…</output>
      </Show>
    </>
  );
};
