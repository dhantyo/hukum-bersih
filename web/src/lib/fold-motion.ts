const INSTANT = "data-fold-instant";
const FRAMES = 2;
const FOLD = "details[data-fold]";

interface Marked {
  toggleAttribute: (name: string, force?: boolean) => boolean;
}

type Later = (step: () => void) => void;

const frames = (count: number, step: () => void, later: Later) => {
  if (count === 0) {
    step();

    return;
  }

  later(() => {
    frames(count - 1, step, later);
  });
};

/** Runs a change that opens or closes folds with their height motion off, until two frames after it. */
export const withoutMotion = (
  root: Marked,
  run?: () => void,
  later: Later = requestAnimationFrame
) => {
  root.toggleAttribute(INSTANT, true);
  run?.();
  frames(
    FRAMES,
    () => {
      root.toggleAttribute(INSTANT, false);
    },
    later
  );
};

/** How far to scroll so an element that sat `before` px from the top of the window sits there again
 * at `after`; an element that began above the window is brought to its top edge. */
export const shiftToKeep = (before: number, after: number) =>
  after - Math.max(before, 0);

const outermostFold = (from: Element | null) => {
  let found: Element | null = null;

  for (
    let node = from?.closest(FOLD) ?? null;
    node !== null;
    node = node.parentElement?.closest(FOLD) ?? null
  ) {
    found = node;
  }

  return found;
};

/** The top-level fold under the top edge of the window, or null when none is. */
export const foldAtTop = (offset: number) =>
  outermostFold(document.elementFromPoint(window.innerWidth / 2, offset));

/** Runs a change to the folds and keeps the fold the reader was in where it was on screen. */
export const keepInView = (anchor: Element | null, run: () => void) => {
  const before = anchor?.getBoundingClientRect().top ?? 0;

  run?.();

  if (anchor !== null) {
    const shift = shiftToKeep(before, anchor.getBoundingClientRect().top);

    if (shift !== 0) {
      window.scrollBy({ top: shift, behavior: "instant" });
    }
  }
};
