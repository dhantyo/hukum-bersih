import { useLocation, useNavigate } from "@solidjs/router";
import type { JSX } from "@solidjs/web";
import * as stylex from "@stylexjs/stylex";
import { createParts } from "@ui-sdk/solid/primitive";
import { createEffect, createSignal, For, onSettled } from "solid-js";

import type { VersionChoice } from "../lib/collection-compare.ts";
import { columnOrder } from "../lib/column-order.ts";
import { springFrom } from "../lib/spring.ts";
import { css } from "../styles/css.ts";
import { linkStyles } from "../styles/link.ts";
import { color, media, shadow, size, space } from "../styles/tokens.stylex.ts";
import { VersionPicker } from "./collection-version-picker.tsx";

const GRABBED = ":is([data-grabbed])";

const SPRING_EASING =
  "linear(0, 0.38 8%, 0.82 16%, 1.08 26%, 1.1 32%, 1.05 42%, 0.99 56%, 1.003 72%, 1)";

const styles = stylex.create({
  form: { margin: 0 },
  columns: {
    columnGap: space.s6,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
    marginBlockStart: space.s3,
    position: "relative",
    "::before": {
      borderRadius: 1,
      insetInline: "25%",
      backgroundColor: color.lineStrong,
      content: '""',
      marginBlockStart: -1,
      position: "absolute",
      height: 2,
      top: "50%",
    },
  },
  column: {
    borderColor: color.lineStrong,
    borderRadius: size.radiusMd,
    borderStyle: "solid",
    borderWidth: 1,
    gap: space.s1,
    paddingBlock: "0.1rem",
    paddingInline: `${space.s2} ${space.s1}`,
    transition: {
      default: `box-shadow 0.25s ease, scale 0.45s ${SPRING_EASING}`,
      "@media (prefers-reduced-motion: reduce)": "none",
    },
    alignItems: "center",
    backgroundColor: color.background,
    boxShadow: {
      [GRABBED]: shadow.pop,
      default: shadow.sm,
    },
    display: "inline-flex",
    justifySelf: "center",
    maxInlineSize: "100%",
    position: "relative",
    scale: { [GRABBED]: 1.05, default: 1 },
    transform: {
      [GRABBED]: "translate(var(--drag-x, 0), var(--drag-y, 0))",
      default: null,
    },
    userSelect: "none",
    zIndex: { [GRABBED]: 3, default: 2 },
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
    display: { default: "grid", [media.tablet]: "none" },
    inlineSize: space.s4,
    outlineColor: color.link,
    outlineOffset: 2,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: 3,
    touchAction: "none",
  },
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
    color: {
      default: color.textMuted,
      ":focus-visible": color.link,
      ":hover": color.link,
    },
    display: { default: "grid", [media.tablet]: "none" },
    inlineSize: space.s6,
    insetInlineStart: "50%",
    position: "absolute",
    transform: "translate(-50%, -50%)",
    zIndex: 1,
    top: "50%",
  },
  submit: {
    font: "inherit",
    borderColor: color.lineStrong,
    borderRadius: size.radius,
    borderStyle: "solid",
    borderWidth: 1,
    marginInline: "auto",
    paddingInline: space.s4,
    backgroundColor: color.background,
    color: color.link,
    cursor: "pointer",
    display: { default: "block", "@media (scripting: enabled)": "none" },
    marginBlockStart: space.s3,
    minBlockSize: size.tap,
  },
});

const { Root, Column, Handle } = createParts(columnOrder, {
  root: "div",
  column: "div",
  handle: "button",
});

const SLOTS = ["dari", "bandingkan"] as const;

let heldVersion: string | undefined;

const useSlide = (key: () => string, versions: () => string) => {
  let el: HTMLElement | undefined;
  let last: DOMRect | undefined;
  let shown: string | undefined;

  const remember = () => {
    last = el?.getBoundingClientRect();
  };

  const spring = () => {
    if (el === undefined) {
      return;
    }

    const now = el.getBoundingClientRect();

    if (last !== undefined) {
      springFrom(el, last.left - now.left, last.top - now.top);
    }

    last = now;
  };

  createEffect(
    () => [key(), versions()] as const,
    ([, ids]) => {
      if (ids === shown) {
        spring();
      } else {
        remember();
      }

      shown = ids;
    }
  );

  onSettled(() => {
    remember();

    const watcher = new MutationObserver(() => {
      if (el?.dataset.grabbed === undefined) {
        document.removeEventListener("pointermove", remember);
        spring();
      } else {
        document.addEventListener("pointermove", remember);
      }
    });

    if (el !== undefined) {
      watcher.observe(el, {
        attributes: true,
        attributeFilter: ["data-grabbed"],
      });
    }

    return () => {
      watcher.disconnect();
      document.removeEventListener("pointermove", remember);
    };
  });

  return (node: HTMLElement) => {
    el = node;
  };
};

const PairColumn = (props: {
  slot: string;
  order: string;
  versions: string;
  class?: string;
  children: JSX.Element;
}) => {
  const ref = useSlide(
    () => props.order,
    () => props.versions
  );

  return (
    <Column value={props.slot} class={props.class} ref={ref}>
      {props.children}
    </Column>
  );
};

const Grip = () => (
  <svg viewBox="0 0 10 16" width="10" height="16" aria-hidden="true">
    <g fill="currentColor">
      <circle cx="3" cy="4" r="1.2" />
      <circle cx="7" cy="4" r="1.2" />
      <circle cx="3" cy="8" r="1.2" />
      <circle cx="7" cy="8" r="1.2" />
      <circle cx="3" cy="12" r="1.2" />
      <circle cx="7" cy="12" r="1.2" />
    </g>
  </svg>
);

const SwapIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path
      d="M3 5.5h9.5m0 0L10 3m2.5 2.5L10 8M13 10.5H3.5m0 0L6 8m-2.5 2.5L6 13"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
);

/**
 * The two versions being compared: one picker per column, joined by a rail. Drag a column's
 * handle across (or pick it up with Space and move it with the arrows) to swap the columns, or
 * press the swap link between them; choosing another version in a picker loads that pair.
 * Without a script the pickers are the fields of a GET form and the swap is a plain link.
 *
 * `href(from, to)` is the search (and hash) the page reads for that pair; `left` and `right`
 * are the ids in the left column (`dari`) and the right one (`bandingkan`).
 */
export const VersionPair = (props: {
  versions: VersionChoice[];
  left: string;
  right: string;
  action: string;
  submitLabel: string;
  href: (from: string, to: string) => string;
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [order, setOrder] = createSignal<string[]>(() =>
    [props.left, props.right].map((_id, index) => SLOTS[index] ?? "dari")
  );

  const idOf = (slot: string) => (slot === "dari" ? props.left : props.right);

  const citeOf = (id: string) =>
    props.versions.find((version) => version.id === id)?.cite ?? id;

  const labels = () => ({
    dari: citeOf(props.left),
    bandingkan: citeOf(props.right),
  });

  const open = (from: string, to: string) => {
    navigate(`${location.pathname}${props.href(from, to)}`);
  };

  let form: HTMLFormElement | undefined;

  createEffect(
    () => [props.left, props.right],
    () => {
      if (heldVersion !== undefined) {
        form
          ?.querySelector<HTMLElement>(`[data-version="${heldVersion}"]`)
          ?.focus();
        heldVersion = undefined;
      }
    }
  );

  return (
    <form
      ref={form}
      class={css(styles.form)}
      method="get"
      action={props.action}
    >
      <Root
        class={css(styles.columns)}
        aria-label="Versi yang dibandingkan"
        value={order()}
        labels={labels()}
        onValueChange={(next) => {
          heldVersion =
            document.activeElement instanceof HTMLElement
              ? document.activeElement.dataset.version
              : undefined;
          setOrder(next);
          const from = idOf(next[0] ?? "dari");
          const to = idOf(next[1] ?? "bandingkan");

          setTimeout(() => {
            open(from, to);
          }, 0);
        }}
      >
        {(state) => (
          <>
            <For each={state.order}>
              {(slot, index) => (
                <PairColumn
                  slot={slot}
                  order={state.order.join(",")}
                  versions={`${props.left}|${props.right}`}
                  class={css(styles.column)}
                >
                  <Handle
                    value={slot}
                    data-version={idOf(slot)}
                    class={css(styles.handle)}
                    aria-label={`Pindahkan kolom ${citeOf(idOf(slot))}`}
                    title="Geser ke sisi lain untuk menukar kolom"
                  >
                    <Grip />
                  </Handle>
                  <VersionPicker
                    name={slot}
                    label={`Versi di kolom ${index() === 0 ? "kiri" : "kanan"}`}
                    versions={props.versions}
                    value={idOf(slot)}
                    onPick={(id) => {
                      open(
                        slot === "dari" ? id : props.left,
                        slot === "dari" ? props.right : id
                      );
                    }}
                  />
                </PairColumn>
              )}
            </For>
            <a
              class={css(linkStyles.base, styles.swap)}
              href={props.href(props.right, props.left)}
              aria-label="Tukar kolom kiri dan kanan"
              title="Tukar kolom"
            >
              <SwapIcon />
            </a>
          </>
        )}
      </Root>
      <button type="submit" class={css(styles.submit)}>
        {props.submitLabel}
      </button>
    </form>
  );
};
