import type { JSX } from "@solidjs/web";
import * as stylex from "@stylexjs/stylex";
import { onSettled } from "solid-js";

import { foldAtTop, keepInView, withoutMotion } from "../lib/fold-motion.ts";
import { collapse } from "../styles/collapse.ts";
import { css } from "../styles/css.ts";
import { linkStyles } from "../styles/link.ts";
import { fold, foldHead } from "../styles/markers.stylex.ts";
import { color, font, media, size, space } from "../styles/tokens.stylex.ts";

const CLOSED = ":not([open])";
const SEEDED = ":is([data-seed])";
const HEAD_HOVER = ":hover";
const NO_HOVER = "@media (hover: none)";
const VIEW_TOP = 100;
const PRINT = "@media print";
const WIDE = "@media (min-width: 961px)";

const styles = stylex.create({
  top: {
    containIntrinsicSize: "auto 60rem",
    contentVisibility: "auto",
    marginInlineStart: { [WIDE]: `calc(-1 * ${space.s6})`, default: null },
    paddingInlineStart: { [WIDE]: space.s6, default: null },
  },
  summary: {
    borderRadius: size.radius,
    listStyle: "none",
    cursor: "pointer",
    display: "block",
    outlineColor: color.link,
    outlineOffset: { default: null, ":focus-visible": 2 },
    outlineStyle: { default: null, ":focus-visible": "solid" },
    outlineWidth: { default: null, ":focus-visible": 3 },
    position: "relative",
  },
  chevron: {
    alignSelf: "flex-start",
    blockSize: 16,
    color: {
      default: color.textMuted,
      [stylex.when.ancestor(HEAD_HOVER, foldHead)]: color.link,
    },
    display: {
      [PRINT]: "none",
      default: "inline-block",
    },
    inlineSize: 16,
    insetInlineStart: {
      default: `calc(-1 * ${space.s6})`,
      [media.tablet]: "auto",
    },
    marginBlockStart: "calc((1lh - 16px) / 2)",
    marginInlineEnd: { default: null, [media.tablet]: space.s1 },
    position: { default: "absolute", [media.tablet]: "relative" },
    transform: {
      default: "rotate(90deg)",
      [stylex.when.ancestor(CLOSED, fold)]: "none",
      [stylex.when.ancestor(SEEDED, fold)]: "none",
    },
    verticalAlign: { default: null, [media.tablet]: "top" },
    "::before": {
      blockSize: 7,
      borderBlockEndColor: "currentColor",
      borderBlockEndStyle: "solid",
      borderBlockEndWidth: 1.6,
      borderInlineEndColor: "currentColor",
      borderInlineEndStyle: "solid",
      borderInlineEndWidth: 1.6,
      content: '""',
      inlineSize: 7,
      insetBlockStart: 4.5,
      insetInlineStart: 2,
      position: "absolute",
      transform: "rotate(-45deg)",
    },
  },
  flexItem: { marginInlineEnd: 0 },
  permalink: {
    paddingInline: space.s1,
    textDecoration: "none",
    color: color.textMuted,
    display: { [PRINT]: "none", default: null },
    fontFamily: font.ui,
    fontSize: size.sm,
    fontWeight: 400,
    insetBlockStart: 0,
    insetInlineEnd: 0,
    opacity: {
      [NO_HOVER]: 1,
      default: 0,
      ":focus-visible": 1,
      [stylex.when.ancestor(HEAD_HOVER, foldHead)]: 1,
    },
    position: "absolute",
  },
});

/** The arrow hanging in the left margin of a fold's heading (before the text on narrow screens). */
export const FoldChevron = (props: { flexItem?: boolean }) => (
  <span
    class={css(
      styles.chevron,
      collapse.turn,
      props.flexItem === true && styles.flexItem
    )}
    aria-hidden="true"
  />
);

/** The "#" that links to a pasal, shown on hover and on keyboard focus (always on touch). */
export const Permalink = (props: { target: string; label: string }) => (
  <a
    class={css(linkStyles.base, styles.permalink)}
    href={`#${props.target}`}
    target="_self"
    aria-label={`Tautan ke ${props.label}`}
  >
    #
  </a>
);

/** A native `<details>` that is open in the HTML, so the text reads without JavaScript, and
 * folds with no script of its own. The browser opens it when find-in-page or a link lands inside. */
export const Fold = (props: {
  id?: string;
  top?: boolean;
  num?: string;
  compared?: boolean;
  class?: string;
  head: JSX.Element;
  children: JSX.Element;
}) => (
  <details
    open
    id={props.id}
    data-fold
    data-collapse
    data-num={props.num}
    data-compared={props.compared === true ? "" : undefined}
    class={[css(fold, props.top === true && styles.top), props.class]}
  >
    <summary class={css(styles.summary, foldHead)}>{props.head}</summary>
    {props.children}
  </details>
);

const folds = () =>
  document.querySelectorAll<HTMLDetailsElement>("details[data-fold]");

/** "Tutup semua" and "Buka semua". */
export const setAllFolds = (open: boolean) => {
  const root = document.documentElement;

  withoutMotion(root, () => {
    keepInView(foldAtTop(VIEW_TOP), () => {
      for (const details of folds()) {
        details.open = open;
      }
    });
  });
};

const revealHash = () => {
  const id = decodeURIComponent(location.hash.slice(1));

  const target =
    id === "" ? null : document.querySelector(`#${CSS.escape(id)}`);

  if (target === null) {
    return;
  }

  withoutMotion(document.documentElement, () => {
    let changed = false;

    for (
      let node: Element | null =
        target.closest("summary")?.parentElement ?? target;
      node !== null;
      node = node.parentElement
    ) {
      if (node instanceof HTMLDetailsElement && !node.open) {
        node.open = true;
        changed = true;
      }
    }

    if (changed) {
      target.scrollIntoView();
    }
  });
};

const revealFound = () => {
  withoutMotion(document.documentElement);
};

const openForPrint = () => {
  let reopened: HTMLDetailsElement[] = [];

  const open = () => {
    reopened = [...folds()].filter((details) => !details.open);

    withoutMotion(document.documentElement, () => {
      for (const details of reopened) {
        details.open = true;
      }
    });
  };

  const restore = () => {
    withoutMotion(document.documentElement, () => {
      for (const details of reopened) {
        details.open = false;
      }
    });

    reopened = [];
  };

  window.addEventListener("beforeprint", open);
  window.addEventListener("afterprint", restore);

  return () => {
    window.removeEventListener("beforeprint", open);
    window.removeEventListener("afterprint", restore);
  };
};

/** One listener each for the whole text, whatever its length. */
export const useFolds = () => {
  onSettled(() => {
    revealHash();
    window.addEventListener("hashchange", revealHash);
    document.addEventListener("beforematch", revealFound, true);

    const stopPrint = openForPrint();

    return () => {
      window.removeEventListener("hashchange", revealHash);
      document.removeEventListener("beforematch", revealFound, true);
      stopPrint();
    };
  });
};
