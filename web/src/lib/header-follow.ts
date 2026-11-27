import { shownPx, step } from "./bar-scroll.ts";
import type { HeaderMode } from "./bar-scroll.ts";

const VAR_NAME = /^var\((?<name>--[^),\s]+)/u;
const FOLLOWER = "[data-under-header]";

/**
 * Makes `header` follow the scroll (see `bar-scroll.ts`) and returns the function that undoes it.
 *
 * `slot` is the header's place in the page: the header leaves it (absolute, then fixed), so the
 * slot keeps the header's height and nothing below it moves. The header carries `data-mode`
 * (`free`, `pinned` or `hidden`), which its styles turn into position and slide. It stays put
 * while focus is in it or its "Aa" popover is open, and tucks away after a jump within the page.
 * `offsetVar` is the `var(--name)` of the variable that tells sticky elements how much of the
 * header covers the window. When it changes, every sticky element marked `data-under-header` slides
 * by `translate` from where it was to its new place, with the header's own transition.
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

  let mode: HeaderMode = "free";
  let lastTop = 0;
  let frame = 0;
  let height = 0;
  let following = false;
  let covered = 0;
  let slides: Animation[] = [];

  const held = () =>
    header.querySelector('[aria-expanded="true"]') !== null ||
    header.contains(document.activeElement);

  const coveredPx = () => (mode === "pinned" ? height : 0);

  const publishCovered = () => {
    const px = coveredPx();

    if (px === covered || offsetName === undefined) {
      return;
    }

    covered = px;
    root.style.setProperty(offsetName, `${px}px`);
  };

  const stopSlides = () => {
    for (const slide of slides) {
      slide.cancel();
    }

    slides = [];
  };

  const slideFollowers = (move: () => void) => {
    stopSlides();

    const followers = [...document.querySelectorAll<HTMLElement>(FOLLOWER)].map(
      (el) => ({ el, top: el.getBoundingClientRect().top })
    );

    move();

    const glide = header
      .getAnimations()
      .find((animation) => animation instanceof CSSTransition)
      ?.effect?.getTiming();

    if (glide === undefined) {
      return;
    }

    const { duration, easing } = glide;

    slides = followers.flatMap(({ el, top }) => {
      const shift = top - el.getBoundingClientRect().top;

      if (shift === 0) {
        return [];
      }

      return [
        el.animate(
          { translate: [`0 ${shift}px`, "0 0"] },
          { duration, easing }
        ),
      ];
    });
  };

  const draw = (from?: number) => {
    header.dataset.mode = mode;
    header.inert = mode === "hidden";

    if (from !== undefined && mode !== "free") {
      header.style.transition = "none";
      header.style.transform = `translateY(${-from}px)`;
      header.getBoundingClientRect();
      header.style.removeProperty("transition");
    }

    header.style.transform = `translateY(${mode === "hidden" ? -height : 0}px)`;

    if (coveredPx() !== covered) {
      slideFollowers(publishCovered);
    }
  };

  const enter = (next: HeaderMode) => {
    const from = height - shownPx(mode, lastTop, height);
    mode = next;
    draw(from);
  };

  const pinIfAway = () => {
    if (mode !== "pinned" && lastTop > 0) {
      enter("pinned");
    }
  };

  const follow = () => {
    frame = 0;
    const top = currentTop();

    if (top === lastTop) {
      return;
    }

    const next = held() ? "pinned" : step(mode, lastTop, top, height);
    lastTop = top;

    if (next !== mode) {
      enter(next);
    }
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
        enter("hidden");
      }
    });
  };

  const sizeSlot = () => {
    height = header.offsetHeight;
    slot.style.height = `${height}px`;

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
    stopSlides();
    slot.style.removeProperty("height");
    delete header.dataset.mode;
    header.inert = false;
    header.style.removeProperty("transform");

    if (offsetName !== undefined) {
      root.style.removeProperty(offsetName);
    }
  };
};
