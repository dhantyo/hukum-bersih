import { createParts } from "@ui-sdk/solid/primitive";

import { columnOrder } from "../lib/column-order.ts";

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
