import type { JSX } from "@solidjs/web";
import * as stylex from "@stylexjs/stylex";
import {
  ScrollArea,
  ScrollAreaContent,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from "@ui-sdk/solid/scroll-area";
import { Show } from "solid-js";

import { css } from "../styles/css.ts";
import { headerOffset } from "../styles/header-offset.stylex.ts";
import { scrollRoot } from "../styles/scroll-row.stylex.ts";
import { color, size, space } from "../styles/tokens.stylex.ts";

const SCRIPTED = "@media (scripting: enabled)";
const NO_SCRIPT = "@media (scripting: none)";
const AT_START = ":is([data-at-x-start])";
const AT_END = ":is([data-at-x-end])";
const VISIBLE = ":is([data-visible])";
const DRAGGING = ":is([data-dragging])";
const SCROLLBAR_SIZE = "0.6rem";
const FADE_SIZE = "1.25rem";

const styles = stylex.create({
  root: { position: "relative" },
  viewport: {
    scrollbarWidth: { [SCRIPTED]: "none", default: "auto" },
  },
  head: {
    "--scroll-area-overflow-x-start": "inherit",
    overflow: "clip",
    backgroundColor: color.background,
    display: { [NO_SCRIPT]: "none", default: "block" },
    position: "sticky",
    zIndex: 2,
    top: headerOffset.shown,
  },
  headTrack: {
    "--scroll-area-overflow-x-start": "inherit",
    translate: "calc(-1 * var(--scroll-area-overflow-x-start, 0px)) 0",
  },
  headInline: { display: { [SCRIPTED]: "none", default: "block" } },
  fade: {
    insetBlock: 0,
    transition: "opacity 0.15s ease",
    inlineSize: FADE_SIZE,
    pointerEvents: "none",
    position: "absolute",
    zIndex: 1,
  },
  fadeStart: {
    backgroundImage: `linear-gradient(to right, ${color.background}, transparent)`,
    insetInlineStart: 0,
    opacity: { default: 1, [stylex.when.ancestor(AT_START, scrollRoot)]: 0 },
  },
  fadeEnd: {
    backgroundImage: `linear-gradient(to left, ${color.background}, transparent)`,
    insetInlineEnd: 0,
    opacity: { default: 1, [stylex.when.ancestor(AT_END, scrollRoot)]: 0 },
  },
  rail: {
    blockSize: SCROLLBAR_SIZE,
    marginBlockStart: space.s1,
    position: "sticky",
    zIndex: 3,
    bottom: 0,
  },
  bar: {
    borderRadius: size.radius,
    transition: "opacity 0.15s ease",
    blockSize: SCROLLBAR_SIZE,
    opacity: { [VISIBLE]: 1, default: 0 },
  },
  thumb: {
    borderRadius: size.radius,
    backgroundColor: {
      [DRAGGING]: color.link,
      default: color.lineStrong,
    },
    blockSize: "100%",
  },
});

/**
 * A row of columns that keep a readable width and scroll sideways when they do not fit, in a
 * ui-sdk scroll area: the browser still scrolls (wheel, Shift and wheel, touch, keys and
 * find-in-page), the area adds a styled bar held at the bottom of the window and a fade at each
 * edge that has more beyond it. `minWidth` is the width the columns need side by side, so a row
 * that fits never scrolls. `head` is a header row: shown in the content without a script, and
 * with one kept under the site header while the rows scroll down and carried sideways with them.
 */
export const ScrollRow = (props: {
  label: string;
  minWidth: string;
  head?: () => JSX.Element;
  class?: string;
  children: JSX.Element;
}) => (
  <ScrollArea type="auto" class={[css(scrollRoot, styles.root), props.class]}>
    <Show when={props.head}>
      {(renderHead) => (
        <div class={css(styles.head)} aria-hidden="true">
          <div
            class={css(styles.headTrack)}
            style={{ "min-inline-size": props.minWidth }}
          >
            {renderHead()()}
          </div>
        </div>
      )}
    </Show>
    <ScrollAreaViewport
      render={(viewport) => <section {...viewport} />}
      aria-label={props.label}
      class={css(styles.viewport)}
    >
      <ScrollAreaContent>
        <div style={{ "min-inline-size": props.minWidth }}>
          <Show when={props.head}>
            {(renderHead) => (
              <div class={css(styles.headInline)} aria-hidden="true">
                {renderHead()()}
              </div>
            )}
          </Show>
          {props.children}
        </div>
      </ScrollAreaContent>
    </ScrollAreaViewport>
    <div class={css(styles.fade, styles.fadeStart)} aria-hidden="true" />
    <div class={css(styles.fade, styles.fadeEnd)} aria-hidden="true" />
    <div class={css(styles.rail)}>
      <ScrollAreaScrollbar orientation="horizontal" class={css(styles.bar)}>
        <ScrollAreaThumb class={css(styles.thumb)} />
      </ScrollAreaScrollbar>
    </div>
  </ScrollArea>
);
