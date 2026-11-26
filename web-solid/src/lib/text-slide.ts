import { onSettled } from "solid-js";

import {
  crossingDim,
  dragAfterMove,
  FAINT,
  FULL,
  GLIDE_MS,
  leftOf,
  limitPill,
  pillTravel,
  poseColumns,
  releaseColumns,
  shownColumns,
  slotShifts,
} from "./column-shift.ts";

const TWO = 2;
const PILL = '[data-slot="column-order-column"]';
const TRANSLATE = "translate";
const DRAG = "--drag-x";
const NEXT_TASK_MS = 0;

interface Session {
  columns: HTMLElement[] | undefined;
  lefts: number[];
  slotCentres: number[];
  centres: number[];
  from: readonly string[];
  live: readonly string[];
  heldByPointer: number | undefined;
  heldLeft: number;
}

const sameOrder = (first: readonly string[], second: readonly string[]) =>
  first.join("\u0000") === second.join("\u0000");

const spanOf = (positions: number[]) =>
  (positions.at(-1) ?? 0) - (positions[0] ?? 0);

const layoutCentreOf = (element: HTMLElement) =>
  element.offsetLeft + element.offsetWidth / 2;

const centreOf = (element: HTMLElement) => {
  const box = element.getBoundingClientRect();

  return box.left + box.width / 2;
};

/**
 * Makes the text columns of a comparison trade places in step with their version pills. While a
 * pill is held with the pointer its text column follows it, locked to the sideways axis; the
 * other column glides to the place the order gives it, and everything settles at the drop. The
 * keys and the swap button play the same glide, one step at a time. A pill that is not held
 * follows the text column of its version, so each pill and its column move as one.
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
  let pace = 0;
  let watcher: MutationObserver | undefined;

  const pills = () => [
    ...(chooser()?.querySelectorAll<HTMLElement>(PILL) ?? []),
  ];

  const heldPill = () =>
    pills().find((pill) => pill.dataset.grabbed !== undefined);

  const followColumns = () => {
    if (session?.columns === undefined) {
      return;
    }

    const { columns, lefts, centres, slotCentres, from, heldByPointer } =
      session;

    const ratio = spanOf(centres) / (spanOf(lefts) || 1);

    for (const pill of pills()) {
      const index = from.indexOf(pill.dataset.version ?? "");
      const column = columns[index];

      const held =
        heldByPointer !== undefined && pill.dataset.grabbed !== undefined;

      if (column === undefined || held) {
        pill.style.removeProperty(TRANSLATE);
      } else {
        const textMoved = (leftOf(column) - (lefts[index] ?? 0)) * ratio;
        const layoutMoved = layoutCentreOf(pill) - (slotCentres[index] ?? 0);

        pill.style.setProperty(TRANSLATE, `${textMoved - layoutMoved}px`);
      }
    }
  };

  const keepPace = () => {
    followColumns();
    pace = requestAnimationFrame(keepPace);
  };

  const stopPace = () => {
    cancelAnimationFrame(pace);

    for (const pill of pills()) {
      pill.style.removeProperty(TRANSLATE);
    }
  };

  const keepHeldUnderPointer = () => {
    const held = heldPill();

    if (session === undefined || held === undefined) {
      return;
    }

    const left = held.offsetLeft;
    const drawn = held.style.getPropertyValue(DRAG);

    if (drawn !== "") {
      held.style.setProperty(
        DRAG,
        `${dragAfterMove(Number(drawn.replace("px", "")), session.heldLeft, left)}px`
      );
    }

    session.heldLeft = left;
  };

  const apply = () => {
    if (session === undefined || session.columns === undefined) {
      return;
    }

    const { lefts, centres, from, live, heldByPointer } = session;
    const held = heldPill();
    const slots = slotShifts(lefts, from, live);

    if (heldByPointer === undefined || held === undefined) {
      poseColumns(slots.map((shift) => ({ shift, dim: FULL, glide: true })));
      followColumns();

      return;
    }

    const place = live.indexOf(from[heldByPointer] ?? "");
    const { least, most } = pillTravel(centres, place);

    limitPill(held, least, most);

    const gap = spanOf(lefts);

    const shift =
      (centreOf(held) - (centres[heldByPointer] ?? 0)) *
      (gap / (spanOf(centres) || 1));

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
    followColumns();
  };

  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(apply);
  };

  const begin = (from: readonly string[], heldByPointer?: number) => {
    const columns = shownColumns();

    session = {
      columns,
      lefts: columns?.map(leftOf) ?? [],
      centres: pills().map(centreOf),
      slotCentres: pills().map(layoutCentreOf),
      from,
      live: from,
      heldByPointer,
      heldLeft: heldPill()?.offsetLeft ?? 0,
    };
    cancelAnimationFrame(pace);
    pace = requestAnimationFrame(keepPace);
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
        stopPace();
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
    window.setTimeout(() => {
      document.addEventListener("pointermove", schedule);
    }, NEXT_TASK_MS);
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

      if (session.heldByPointer !== undefined) {
        keepHeldUnderPointer();
        apply();
      }
    }

    schedule();
  };

  const reset = () => {
    window.clearTimeout(release);
    session = undefined;
    stopPace();
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
      stopPace();
      releaseColumns();
    };
  });

  return { follow, pointerDown, reset };
};
