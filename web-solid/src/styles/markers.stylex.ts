import * as stylex from "@stylexjs/stylex";

export const timelineItem = stylex.defineMarker();

export const versionEntry = stylex.defineMarker();

/** On a folding `<details>`. Its parts read `:not([open])` through `stylex.when.ancestor`, which
 * is exact for any part you can see: a part under a closed ancestor is hidden, so the only closed
 * `<details>` that can match a visible part is its own. */
export const fold = stylex.defineMarker();

/** On the clickable head of a fold, so a part inside it can react to the pointer. */
export const foldHead = stylex.defineMarker();

/** On the trigger of the versions list, so its arrow follows `data-open`. */
export const versionHead = stylex.defineMarker();

/** On a row of the versions list, so its dot and its label follow `data-here`. */
export const versionRow = stylex.defineMarker();

/** On the link of a version row, so its label follows the pointer. */
export const versionLink = stylex.defineMarker();
