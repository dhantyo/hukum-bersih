import type { JSX } from "@solidjs/web";
import * as stylex from "@stylexjs/stylex";
import {
  Timeline,
  TimelineConnector,
  TimelineDescription,
  TimelineItem,
  TimelineMarker,
  TimelineTime,
  TimelineTitle,
} from "@ui-sdk/solid/timeline";

import { css } from "../styles/css.ts";
import { color, size, space } from "../styles/tokens.stylex.ts";

const DOT = "12px";
const LAST = ":last-child";

const styles = stylex.create({
  list: {
    margin: 0,
    padding: 0,
    maxInlineSize: size.measure,
  },
  item: {
    borderRadius: size.radius,
    columnGap: `calc(${space.s6} - ${DOT})`,
    display: "grid",
    gridTemplateColumns: `${DOT} minmax(0, 1fr)`,
    outlineColor: color.link,
    outlineOffset: { default: null, ":focus-visible": 2 },
    outlineStyle: { default: null, ":focus-visible": "solid" },
    outlineWidth: { default: null, ":focus-visible": 3 },
    paddingBlockEnd: { [LAST]: 0, default: space.s5 },
    position: "relative",
  },
  itemNarrow: {
    columnGap: `calc(${space.s5} - ${DOT})`,
    paddingBlockEnd: { [LAST]: 0, default: space.s4 },
  },
  marker: {
    borderColor: color.link,
    borderRadius: "50%",
    borderStyle: "solid",
    borderWidth: 2,
    gridColumn: 1,
    backgroundColor: color.background,
    blockSize: DOT,
    boxSizing: "border-box",
    inlineSize: DOT,
    marginBlockStart: "0.3rem",
    zIndex: 1,
  },
  filled: { backgroundColor: color.link },
  warn: { borderColor: color.warn },
  gone: { borderColor: color.gone },
  goneFilled: { borderColor: color.gone, backgroundColor: color.gone },
  missing: { borderColor: color.gone, borderStyle: "dashed" },
  connector: {
    backgroundColor: color.line,
    display: { default: "block", [stylex.when.ancestor(LAST)]: "none" },
    inlineSize: 2,
    insetBlockEnd: "-0.3rem",
    insetBlockStart: "0.3rem",
    insetInlineStart: 5,
    position: "absolute",
  },
  dotted: {
    backgroundColor: "transparent",
    backgroundImage: `repeating-linear-gradient(to bottom, ${color.gone} 0 3px, transparent 3px 8px)`,
  },
  content: { margin: 0, gridColumn: 2, minInlineSize: 0 },
  time: {
    color: color.textMuted,
    display: "block",
    fontSize: size.xs,
    fontVariantNumeric: "tabular-nums",
  },
});

export type EventTone =
  | "default"
  | "filled"
  | "warn"
  | "gone"
  | "goneFilled"
  | "missing";

const markerTone = {
  default: null,
  filled: styles.filled,
  warn: styles.warn,
  gone: styles.gone,
  goneFilled: styles.goneFilled,
  missing: styles.missing,
} as const;

/** Dated events down a line, built from ui-sdk `Timeline` (one tab stop, arrow keys between events). */
export const HistoryTimeline = (props: {
  label: string;
  children: JSX.Element;
}) => (
  <Timeline class={css(styles.list)} aria-label={props.label}>
    {props.children}
  </Timeline>
);

/**
 * One event on the line. `dotted` draws the line below it dotted, for a gap in what is known;
 * `narrow` pulls the text closer to the line.
 */
export const HistoryEvent = (props: {
  tone?: EventTone;
  dotted?: boolean;
  narrow?: boolean;
  children: JSX.Element;
}) => (
  <TimelineItem
    class={css(
      styles.item,
      props.narrow === true && styles.itemNarrow,
      stylex.defaultMarker()
    )}
  >
    <TimelineMarker
      class={css(styles.marker, markerTone[props.tone ?? "default"])}
    />
    <TimelineConnector
      class={css(styles.connector, props.dotted === true && styles.dotted)}
    />
    {props.children}
  </TimelineItem>
);

export const EventTime = (props: {
  datetime?: string;
  children: JSX.Element;
}) => (
  <TimelineTime
    class={css(styles.content, styles.time)}
    datetime={props.datetime}
  >
    {props.children}
  </TimelineTime>
);

export const EventTitle = (props: { children: JSX.Element }) => (
  <TimelineTitle class={css(styles.content)}>{props.children}</TimelineTitle>
);

export const EventNote = (props: { children: JSX.Element }) => (
  <TimelineDescription class={css(styles.content)}>
    {props.children}
  </TimelineDescription>
);

/** Anything else that belongs to the event, in the text column. */
export const EventBody = (props: { children: JSX.Element }) => (
  <div class={css(styles.content)}>{props.children}</div>
);
