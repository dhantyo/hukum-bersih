import { onSettled } from "solid-js";

import {
  columnLefts,
  crossingDim,
  FAINT,
  FULL,
  followShift,
  GLIDE_MS,
  limitPill,
  pillTravel,
  poseColumns,
  releaseColumns,
  slotShifts,
} from "./column-shift.ts";

const TWO = 2;
const PILL = '[data-slot="column-order-column"]';
const DRAG_X = "--drag-x";

interface Session {
  lefts: number[] | undefined;
  centres: number[];
  from: readonly string[];
  live: readonly string[];
  heldByPointer: number | undefined;
}

const sameOrder = (first: readonly string[], second: readonly string[]) =>
  first.join("\u0000") === second.join("\u0000");

const dragOf = (pill: HTMLElement) =>
  Number(pill.style.getPropertyValue(DRAG_X).replace("px", "")) || 0;

const centreOf = (element: HTMLElement) => {
  const box = element.getBoundingClientRect();

  return box.left + box.width / 2;
};

/**
 * Makes the text columns of a comparison trade places in step with their version pills. While a
 * pill is held with the pointer its text column follows it, locked to the sideways axis; the
 * other column glides to the place the order gives it, and everything settles at the drop. The
 * keys and the swap button play the same glide, one step at a time.
 *
 * `keys` are the columns in the order the page shows them, `chooser` is the element that holds
 * the pills. Call `follow` with the order the pills show now, `pointerDown` when a handle is
 * pressed, and `reset` when the page has loaded the new order.
 */
export const createTextSlide = (
  keys: () => string[],
  chooser: () => HTMLElement | undefined
) => {
  let session: Session | undefined;
  let frame = 0;
  let release = 0;
  let watcher: MutationObserver | undefined;

  const pills = () => [
    ...(chooser()?.querySelectorAll<HTMLElement>(PILL) ?? []),
  ];

  const heldPill = () =>
    pills().find((pill) => pill.dataset.grabbed !== undefined);

  const apply = () => {
    if (session === undefined || session.lefts === undefined) {
      return;
    }

    const { lefts, centres, from, live, heldByPointer } = session;
    const held = heldPill();
    const slots = slotShifts(lefts, from, live);

    if (heldByPointer === undefined || held === undefined) {
      poseColumns(slots.map((shift) => ({ shift, dim: FULL, glide: true })));

      return;
    }

    const place = live.indexOf(from[heldByPointer] ?? "");
    const { least, most } = pillTravel(centres, place);

    const dragged =
      (centres[place] ?? 0) - (centres[heldByPointer] ?? 0) + dragOf(held);

    const shift = followShift(dragged, centres, lefts, heldByPointer);
    const gap = (lefts.at(-1) ?? 0) - (lefts[0] ?? 0);

    limitPill(held, least, most);

    poseColumns(
      from.map((_key, index) => {
        if (index === heldByPointer) {
          return { shift, dim: FULL, glide: false };
        }

        if (from.length === TWO) {
          return { shift: -shift, dim: crossingDim(shift, gap), glide: false };
        }

        return { shift: slots[index] ?? 0, dim: FAINT, glide: true };
      })
    );
  };

  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(apply);
  };

  const begin = (from: readonly string[], heldByPointer?: number) => {
    session = {
      lefts: columnLefts(),
      centres: pills().map(centreOf),
      from,
      live: from,
      heldByPointer,
    };
  };

  const settle = () => {
    if (session === undefined || heldPill() !== undefined) {
      return;
    }

    session.heldByPointer = undefined;
    apply();

    if (sameOrder(session.live, session.from)) {
      release = window.setTimeout(() => {
        session = undefined;
        releaseColumns();
      }, GLIDE_MS);
    }
  };

  const stopListening = () => {
    document.removeEventListener("pointermove", schedule);
    document.removeEventListener("pointerup", endPointer);
    document.removeEventListener("pointercancel", endPointer);
  };

  const endPointer = () => {
    stopListening();
    schedule();
  };

  const pointerDown = (event: PointerEvent) => {
    const pill =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>(PILL)
        : null;

    const index = pill === null ? -1 : pills().indexOf(pill);

    if (index < 0) {
      return;
    }

    window.clearTimeout(release);
    begin(keys(), index);
    document.addEventListener("pointermove", schedule);
    document.addEventListener("pointerup", endPointer);
    document.addEventListener("pointercancel", endPointer);
  };

  const follow = (order: readonly string[], from: readonly string[]) => {
    if (session === undefined) {
      if (sameOrder(order, from)) {
        return;
      }

      window.clearTimeout(release);
      begin(from);
    }

    if (session !== undefined) {
      session.live = order;
    }

    schedule();
  };

  const reset = () => {
    window.clearTimeout(release);
    session = undefined;
    releaseColumns();
  };

  onSettled(() => {
    const root = chooser();

    if (root !== undefined) {
      watcher = new MutationObserver(settle);
      watcher.observe(root, {
        attributes: true,
        attributeFilter: ["data-grabbed"],
        subtree: true,
      });
    }

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(release);
      watcher?.disconnect();
      stopListening();
      releaseColumns();
    };
  });

  return { follow, pointerDown, reset };
};
