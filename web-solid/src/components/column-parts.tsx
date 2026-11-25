import type { JSX } from "@solidjs/web";
import { createParts } from "@ui-sdk/solid/primitive";
import { createEffect, onSettled } from "solid-js";

import { columnOrder } from "../lib/column-order.ts";
import { springFrom } from "../lib/spring.ts";

/** The parts of a row of reorderable version columns: the row, a column and its drag handle. */
export const { Root, Column, Handle } = createParts(columnOrder, {
  root: "div",
  column: "div",
  handle: "button",
});

export const Grip = () => (
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

const useSlide = (order: () => string, versions: () => string) => {
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
    () => [order(), versions()] as const,
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

/**
 * A column that springs to its new place when the order changes (the other column, as one is
 * dragged across or moved with the keys) and when a held column is dropped. A change of the
 * versions themselves, the page loading the choice that was just made, is not animated: the
 * columns already show it.
 */
export const SlidingColumn = (props: {
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
