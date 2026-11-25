import { solveSpring } from "@ui-sdk/core/gesture";

const RESPONSE_SECONDS = 0.4;
const DAMPING_RATIO = 0.72;
const FRAME_MS = 16;
const LIMIT_MS = 900;
const SETTLED_PX = 0.4;
const MIN_MOVE_PX = 2;

const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Slides an element to where it now is from where it was (`fromX` and `fromY` are the old
 * position minus the new one) on a spring from ui-sdk's `solveSpring`. It animates `translate`,
 * so it does not fight the `transform` that `createReorder` writes while a column is held, and
 * it does nothing when the reader asks for less motion.
 */
export const springFrom = (el: HTMLElement, fromX: number, fromY = 0) => {
  if (reducedMotion() || Math.hypot(fromX, fromY) < MIN_MOVE_PX) {
    return;
  }

  const horizontal = solveSpring(RESPONSE_SECONDS, DAMPING_RATIO, fromX, 0);
  const vertical = solveSpring(RESPONSE_SECONDS, DAMPING_RATIO, fromY, 0);
  const frames: Keyframe[] = [];
  let elapsed = 0;

  while (elapsed < LIMIT_MS) {
    const x = horizontal.position(elapsed);
    const y = vertical.position(elapsed);

    frames.push({ translate: `${x}px ${y}px` });

    const settled =
      Math.abs(x) < SETTLED_PX &&
      Math.abs(y) < SETTLED_PX &&
      Math.abs(horizontal.velocity(elapsed)) < SETTLED_PX / FRAME_MS;

    if (elapsed > 0 && settled) {
      break;
    }

    elapsed += FRAME_MS;
  }

  frames.push({ translate: "0px 0px" });
  el.animate(frames, { duration: elapsed + FRAME_MS, easing: "linear" });
};
