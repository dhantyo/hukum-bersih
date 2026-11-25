import { settledBarOffset, shownPx, step } from "./bar-scroll.ts";
import type { HeaderState } from "./bar-scroll.ts";

const SETTLE_MS = 140;

const VAR_NAME = /^var\((?<name>--[^),\s]+)/u;

/**
 * Makes `header` follow the scroll (see `bar-scroll.ts`) and returns the function that undoes it.
 *
 * `slot` is the header's place in the page: the header leaves it (absolute, then fixed), so the
 * slot keeps the header's height and nothing below it moves. The header carries `data-mode`
 * (`free`, `pinned` or `hidden`), which its styles turn into position and slide. It stays put
 * while focus is in it or its "Aa" popover is open, and tucks away after a jump within the page.
 * `offsetVar` is the `var(--name)` of the variable that tells sticky elements how much of the
 * header covers the window.
 */
export const followHeader = (
  header: HTMLElement,
  slot: HTMLElement,
  offsetVar: string
) => {
  const root = document.documentElement;
  const offsetName = VAR_NAME.exec(offsetVar)?.groups?.name;
  const maxTop = () => root.scrollHeight - innerHeight;

  const currentTop = () =>
    Math.min(Math.max(0, scrollY), Math.max(0, maxTop()));

  let state: HeaderState = { mode: "free", y: 0 };
  let lastTop = 0;
  let direction = 0;
  let frame = 0;
  let height = 0;
  let following = false;
  let covered = -1;
  let settle: ReturnType<typeof setTimeout> | undefined;

  const held = () =>
    header.querySelector('[aria-expanded="true"]') !== null ||
    header.contains(document.activeElement);

  const publishCovered = () => {
    const px = state.mode === "pinned" ? height : 0;

    if (px === covered || offsetName === undefined) {
      return;
    }

    covered = px;
    root.style.setProperty(offsetName, `${px}px`);
  };

  const shiftOf = (current: HeaderState) => {
    if (current.mode === "free") {
      return current.y;
    }

    return current.mode === "hidden" ? -height : 0;
  };

  const draw = (from?: number) => {
    header.dataset.mode = state.mode;
    header.inert = state.mode === "hidden";

    if (from !== undefined && state.mode !== "free") {
      header.style.transition = "none";
      header.style.transform = `translateY(${-from}px)`;
      header.getBoundingClientRect();
      header.style.removeProperty("transition");
    }

    header.style.transform = `translateY(${shiftOf(state)}px)`;
    publishCovered();
  };

  const moveTo = (mode: "pinned" | "hidden") => {
    const from = height - shownPx(state, lastTop, height);
    state = { mode };
    draw(from);
  };

  const pinIfAway = () => {
    if (state.mode !== "pinned" && lastTop > 0) {
      moveTo("pinned");
    }
  };

  const settleHalfHidden = () => {
    if (state.mode !== "free") {
      return;
    }

    const shown = shownPx(state, lastTop, height);
    const placed = shown === height && lastTop === state.y;
    const atTop = lastTop <= height && state.y === 0;

    if (shown === 0 || placed || atTop) {
      return;
    }

    moveTo(
      settledBarOffset(height - shown, lastTop, height, direction) === 0
        ? "pinned"
        : "hidden"
    );
  };

  const follow = () => {
    frame = 0;
    const top = currentTop();

    if (top === lastTop) {
      return;
    }

    direction = Math.sign(top - lastTop);

    if (held()) {
      lastTop = top;

      if (state.mode !== "pinned") {
        moveTo("pinned");
      }

      return;
    }

    const next = step(state, lastTop, top, height);
    lastTop = top;

    const moved =
      next.mode !== state.mode ||
      (next.mode === "free" && state.mode === "free" && next.y !== state.y);

    if (moved) {
      state = next;
      draw();
    }

    clearTimeout(settle);
    settle = setTimeout(settleHalfHidden, SETTLE_MS);
  };

  const onScroll = () => {
    if (following && frame === 0) {
      frame = requestAnimationFrame(follow);
    }
  };

  const onHashChange = () => {
    requestAnimationFrame(() => {
      lastTop = Math.max(0, scrollY);

      if (lastTop > height) {
        moveTo("hidden");
      }
    });
  };

  const sizeSlot = () => {
    height = header.offsetHeight;
    slot.style.height = `${height}px`;
    covered = -1;

    if (following) {
      publishCovered();

      return;
    }

    following = true;
    lastTop = Math.max(0, scrollY);
    draw();
  };

  const observer = new ResizeObserver(sizeSlot);

  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("hashchange", onHashChange);
  header.addEventListener("focusin", pinIfAway);
  observer.observe(header);

  return () => {
    removeEventListener("scroll", onScroll);
    removeEventListener("hashchange", onHashChange);
    header.removeEventListener("focusin", pinIfAway);
    observer.disconnect();
    cancelAnimationFrame(frame);
    clearTimeout(settle);
    slot.style.removeProperty("height");
    delete header.dataset.mode;
    header.inert = false;
    header.style.removeProperty("transform");

    if (offsetName !== undefined) {
      root.style.removeProperty(offsetName);
    }
  };
};
