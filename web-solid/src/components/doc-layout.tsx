import type { JSX } from "@solidjs/web";
import * as stylex from "@stylexjs/stylex";
import { For, onSettled } from "solid-js";

import { css } from "../styles/css.ts";
import { linkClass } from "../styles/link.ts";
import { color, size, space } from "../styles/tokens.stylex.ts";

const styles = stylex.create({
  wrap: {
    marginInline: "auto",
    paddingInline: space.s4,
    boxSizing: "border-box",
    maxInlineSize: size.page,
  },
  crumbs: {
    gap: space.s2,
    color: color.textMuted,
    display: "flex",
    flexWrap: "wrap",
    fontSize: size.sm,
    marginBlockStart: space.s3,
  },
  head: {
    marginBlock: `${space.s4} ${space.s6}`,
    maxInlineSize: "52rem",
  },
  headRow: {
    gap: space.s3,
    alignItems: "start",
    display: "flex",
    justifyContent: "space-between",
  },
  eyebrow: { margin: 0, color: color.textMuted },
  title: { margin: 0, marginBlockEnd: space.s2 },
  meta: { marginBlockStart: space.s3 },
  doc: {
    gap: { default: space.s7, "@media (max-width: 960px)": 0 },
    alignItems: "start",
    display: "grid",
    gridTemplateColumns: {
      default: `${size.panel} minmax(0, 1fr)`,
      "@media (max-width: 960px)": "1fr",
    },
  },
  panel: {
    fontSize: size.sm,
    maxBlockSize: {
      default: "calc(100vh - 2rem)",
      "@media (max-width: 960px)": "none",
    },
    paddingInlineEnd: space.s2,
    position: { default: "sticky", "@media (max-width: 960px)": "static" },
    overflowY: { default: "auto", "@media (max-width: 960px)": "visible" },
    top: space.s4,
  },
  panelSummary: {
    cursor: "pointer",
    display: { default: "none", "@media (max-width: 960px)": "block" },
    fontWeight: 600,
    marginBlockEnd: space.s3,
    minBlockSize: size.tap,
  },
  main: { minInlineSize: 0 },
});

export interface Crumb {
  href?: string;
  label: string;
}

const PHONE = "(max-width: 960px)";

export const DocLayout = (props: {
  crumbs: Crumb[];
  eyebrow: string;
  title: string;
  headMeta: JSX.Element;
  tools: JSX.Element;
  panelLabel: string;
  panel: JSX.Element;
  children: JSX.Element;
}) => {
  let panel: HTMLDetailsElement | undefined;

  onSettled(() => {
    if (panel && matchMedia(PHONE).matches) {
      panel.open = false;
    }
  });

  return (
    <div class={css(styles.wrap)}>
      <nav class={css(styles.crumbs)} aria-label="Lokasi" data-pagefind-ignore>
        <For each={props.crumbs}>
          {(crumb, index) => (
            <>
              {index() > 0 && <span aria-hidden="true">›</span>}
              {crumb.href === undefined ? (
                <span>{crumb.label}</span>
              ) : (
                <a class={linkClass} href={crumb.href}>
                  {crumb.label}
                </a>
              )}
            </>
          )}
        </For>
      </nav>
      <header class={css(styles.head)}>
        <div class={css(styles.headRow)}>
          <div>
            <p class={css(styles.eyebrow)}>{props.eyebrow}</p>
            <h1 class={css(styles.title)}>{props.title}</h1>
          </div>
          {props.tools}
        </div>
        <div class={css(styles.meta)} data-pagefind-ignore>
          {props.headMeta}
        </div>
      </header>
      <div class={css(styles.doc)}>
        <aside
          class={css(styles.panel)}
          aria-label={props.panelLabel}
          data-pagefind-ignore
        >
          <details
            open
            ref={(element: HTMLDetailsElement) => {
              panel = element;
            }}
          >
            <summary class={css(styles.panelSummary)}>
              {props.panelLabel}
            </summary>
            {props.panel}
          </details>
        </aside>
        <div class={css(styles.main)}>{props.children}</div>
      </div>
    </div>
  );
};
