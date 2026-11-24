import { useLinkState, useLocation } from "@solidjs/router";
import * as stylex from "@stylexjs/stylex";
import { Show, For } from "solid-js";

import { slashed } from "../lib/paths.ts";
import { Router } from "../router.tsx";
import { css } from "../styles/css.ts";
import { color, size, space } from "../styles/tokens.stylex.ts";
import { accessibility } from "../styles/visually-hidden.ts";

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
    backgroundColor: color.background,
    borderBlockEndColor: color.line,
    borderBlockEndStyle: "solid",
    borderBlockEndWidth: 1,
  },
  bar: {
    marginInline: "auto",
    paddingBlock: space.s3,
    paddingInline: space.s4,
    alignItems: "center",
    columnGap: space.s4,
    display: "flex",
    flexWrap: "wrap",
    rowGap: space.s3,
    maxWidth: size.page,
    minHeight: "4rem",
  },
  brand: {
    textDecoration: "none",
    color: color.text,
    fontSize: size.lg,
    fontWeight: 700,
    letterSpacing: "-0.01em",
  },
  nav: { gap: space.s4, display: "flex" },
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
    flexBasis: "20rem",
    flexGrow: "0",
    flexShrink: "1",
    marginInlineStart: "auto",
  },
  field: {
    font: "inherit",
    borderColor: color.lineStrong,
    borderRadius: size.radius,
    borderStyle: "solid",
    borderWidth: 1,
    paddingBlock: space.s2,
    paddingInline: space.s3,
    backgroundColor: color.backgroundSubtle,
    boxSizing: "border-box",
    color: color.text,
    fontSize: size.sm,
    width: "100%",
  },
});

const sections = [
  { href: slashed(Router.paths.uu), label: "Peraturan" },
  { href: slashed(Router.paths.koleksi), label: "Koleksi" },
  { href: slashed(Router.paths.ruu), label: "RUU" },
  { href: slashed(Router.paths.tentang), label: "Tentang" },
];

const SectionLink = (props: { href: string; label: string }) => {
  const link = useLinkState(() => props.href);

  return (
    <a
      class={css(styles.link, link.active() && styles.linkActive)}
      href={props.href}
      aria-current={link.active() ? "page" : undefined}
    >
      {props.label}
    </a>
  );
};

/** The home page has its own search field, so the header drops its own. */
export const SiteHeader = (props: { pending: boolean }) => {
  const location = useLocation();

  return (
    <>
      <a class={css(styles.skip)} href="#main">
        Langsung ke isi
      </a>
      <header class={css(styles.header)}>
        <div class={css(styles.bar)}>
          <a class={css(styles.brand)} href={Router.paths()}>
            Hukum Bersih
          </a>
          <nav class={css(styles.nav)} aria-label="Utama">
            <For each={sections}>
              {(section) => (
                <SectionLink href={section.href} label={section.label} />
              )}
            </For>
          </nav>
          <Show when={location.pathname !== Router.paths()}>
            <form
              class={css(styles.search)}
              action={slashed(Router.paths.cari)}
              method="get"
              // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- keeps the form markup the Astro site serves
              role="search"
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
          </Show>
        </div>
      </header>
      <Show when={props.pending}>
        <output>Memuat…</output>
      </Show>
    </>
  );
};
