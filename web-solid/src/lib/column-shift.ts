import {
  columnDim,
  columnGlide,
  columnShift,
  pillRange,
} from "../styles/column-shift.stylex.ts";

const SLIDING = "data-cmp-sliding";
const COLUMN = "data-cmp-column";
const VAR_NAME = /^var\((?<name>--[^),\s]+)/u;
const GLIDE = "0.32s";
const NO_GLIDE = "0s";

/** How long a column takes to reach its new place; the reader waits this long before the page loads. */
export const GLIDE_MS = 320;

const clamp = (value: number, least: number, most: number) =>
  Math.min(Math.max(value, least), most);

/** How faint a column is while another is held (1 is as printed). */
export const FULL = 1;
export const FAINT = 0.45;
const CROSSING_LOSS = 0.8;

/** The column that gives way fades as the held one passes over it, most where they are level. */
export const crossingDim = (shift: number, gap: number) =>
  gap === 0
    ? FULL
    : FULL -
      CROSSING_LOSS *
        Math.sin(Math.PI * clamp(Math.abs(shift) / Math.abs(gap), 0, 1));

/** The most text columns that move with their pills. */
export const SLIDING_COLUMNS = 6;

const variableNames = (...variables: string[]) =>
  variables.map((variable) => VAR_NAME.exec(variable)?.groups?.name ?? "");

const shiftNames = variableNames(
  columnShift.shift0,
  columnShift.shift1,
  columnShift.shift2,
  columnShift.shift3,
  columnShift.shift4,
  columnShift.shift5
);

const dimNames = variableNames(
  columnDim.dim0,
  columnDim.dim1,
  columnDim.dim2,
  columnDim.dim3,
  columnDim.dim4,
  columnDim.dim5
);

const glideNames = variableNames(
  columnGlide.glide0,
  columnGlide.glide1,
  columnGlide.glide2,
  columnGlide.glide3,
  columnGlide.glide4,
  columnGlide.glide5
);

const [leastName = "", mostName = ""] = variableNames(
  pillRange.least,
  pillRange.most
);

/** How far each column (by its place when the move began) goes to reach the place `to` gives its version. */
export const slotShifts = (
  lefts: number[],
  from: readonly string[],
  to: readonly string[]
) =>
  from.map((key, index) => {
    const place = to.indexOf(key);

    return (lefts[place] ?? lefts[index] ?? 0) - (lefts[index] ?? 0);
  });

/** How far a pill may be dragged sideways from its own place: to the first pill and to the last. */
export const pillTravel = (centres: number[], index: number) => ({
  least: (centres[0] ?? 0) - (centres[index] ?? 0),
  most: (centres.at(-1) ?? 0) - (centres[index] ?? 0),
});

const prefersStill = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The text column shown for each place, from the first one; none when the columns are not side by side. */
export const shownColumns = () => {
  const shown: HTMLElement[] = [];

  for (let index = 0; index < SLIDING_COLUMNS; index += 1) {
    const element = [
      ...document.querySelectorAll<HTMLElement>(`[${COLUMN}="${index}"]`),
    ].find((candidate) => candidate.offsetParent !== null);

    if (element === undefined) {
      break;
    }

    shown.push(element);
  }

  return shown.length > 1 ? shown : undefined;
};

export const leftOf = (element: HTMLElement) =>
  element.getBoundingClientRect().left;

export interface ColumnPose {
  shift: number;
  dim: number;
  glide: boolean;
}

/** Moves the text columns, one pose each, and marks the page as sliding. */
export const poseColumns = (poses: ColumnPose[]) => {
  const root = document.documentElement;
  const glide = prefersStill() ? NO_GLIDE : GLIDE;

  root.setAttribute(SLIDING, "");

  for (const [index, pose] of poses.entries()) {
    root.style.setProperty(shiftNames[index] ?? "", `${pose.shift}px`);
    root.style.setProperty(dimNames[index] ?? "", String(pose.dim));
    root.style.setProperty(
      glideNames[index] ?? "",
      pose.glide ? glide : NO_GLIDE
    );
  }
};

/** Puts the text columns back where the page draws them. */
export const releaseColumns = () => {
  const root = document.documentElement;

  root.removeAttribute(SLIDING);

  for (const name of [...shiftNames, ...dimNames, ...glideNames]) {
    root.style.removeProperty(name);
  }
};

/** Lets a held pill travel only between the first pill and the last. */
export const limitPill = (pill: HTMLElement, least: number, most: number) => {
  pill.style.setProperty(leastName, `${least}px`);
  pill.style.setProperty(mostName, `${most}px`);
};
