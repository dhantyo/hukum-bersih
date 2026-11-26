import { isServer } from "@solidjs/web";

/**
 * The width of a document page's side panel, in rem: where it starts, how far a reader can
 * drag it, and the strip it folds to. The strip is `size.tap` in `styles/tokens.stylex.ts`;
 * change both together.
 *
 * The maximum keeps the text at its measure on a full-width page: the page's 70rem of content,
 * less the handle's 1.5rem and the text's 1.5rem lead, less 24rem here, leaves 43rem.
 */
export const PANEL_REM = {
  collapsed: 2.75,
  default: 17,
  max: 24,
  min: 13,
} as const;

export const PANEL_WIDTH_KEY = "hb-panel-width";

const WIDTH_STEP = 0.01;

const SAVED_WIDTH = /^\d{1,2}(?:\.\d{1,2})?$/u;

/** A stored width, or `null` when it is missing, malformed or outside what a reader can drag to. */
export const parseWidth = (raw: string | null) => {
  if (!SAVED_WIDTH.test(raw ?? "")) {
    return null;
  }

  const rem = Number(raw);

  return rem >= PANEL_REM.min && rem <= PANEL_REM.max ? rem : null;
};

/** The saved width in rem, read in the browser only. Blocked storage reads as "none saved". */
export const readSavedWidth = () => {
  if (isServer) {
    return null;
  }

  try {
    return parseWidth(localStorage.getItem(PANEL_WIDTH_KEY));
  } catch {
    return null;
  }
};

/** Keeps the width for the next visit; false when storage is blocked, so the width lasts until the page is left. */
export const saveWidth = (rem: number) => {
  try {
    localStorage.setItem(
      PANEL_WIDTH_KEY,
      (Math.round(rem / WIDTH_STEP) * WIDTH_STEP).toFixed(2)
    );

    return true;
  } catch {
    return false;
  }
};

/**
 * Inline script placed just before the panel group. It runs while the page is parsed, so the
 * panel is first painted at the saved width: it sets the custom property the panel's flex basis
 * reads (`--resizable-panel-size`, ui-sdk Resizable) on the script's parent, which never carries
 * an inline style of its own. A page cached at the edge is the same for every reader, so a
 * cookie the server reads would not do.
 */
export const WIDTH_SCRIPT = `try{var w=localStorage.getItem("${PANEL_WIDTH_KEY}");if(/${SAVED_WIDTH.source}/.test(w)&&w>=${PANEL_REM.min}&&w<=${PANEL_REM.max}){document.currentScript.parentElement.style.setProperty("--resizable-panel-size",w+"rem")}}catch(e){}`;
