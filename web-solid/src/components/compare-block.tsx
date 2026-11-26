import * as stylex from "@stylexjs/stylex";
import { For, Match, Show, Switch } from "solid-js";

import type {
  CompareCell,
  CompareLine,
  CompareRow,
  Mark,
  Piece,
} from "../lib/compare.ts";
import { isPresent } from "../lib/text.ts";
import { changes } from "../styles/changes.ts";
import { slidingColumn } from "../styles/column-slide.ts";
import { css } from "../styles/css.ts";
import { reading } from "../styles/reading.ts";
import { color, font, media, size, space } from "../styles/tokens.stylex.ts";

const WIDE = "@media (min-width: 961px)";
const FITS = "@container (min-width: 42rem)";
const COLUMN_WIDTH = "17rem";
const COLUMN_GAP = "1rem";

const styles = stylex.create({
  ins: { color: color.ok },
  del: { color: color.delText },
  mod: { color: color.warn },
  legend: {
    margin: 0,
    gap: `${space.s1} ${space.s4}`,
    color: color.textMuted,
    display: "flex",
    flexWrap: "wrap",
    fontSize: size.xs,
    justifyContent: "center",
    marginBlockStart: space.s2,
  },
  legendItem: { gap: space.s1, alignItems: "center", display: "inline-flex" },
  modText: {
    borderRadius: 2,
    backgroundColor: color.modBackground,
    color: color.modText,
  },
  modOld: { textDecoration: "line-through" },
  none: {
    borderRadius: 2,
    paddingInline: space.s1,
    backgroundColor: color.backgroundSubtle,
    color: color.textMuted,
    fontStyle: "italic",
  },
  gone: { color: color.gone, fontStyle: "italic" },
  block: {
    marginBlock: `${space.s2} ${space.s4}`,
    borderBlockStartColor: color.line,
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: 1,
    containerType: "inline-size",
    fontSize: { default: "inherit", "@media (max-width: 960px)": size.base },
    paddingBlockStart: space.s3,
  },
  flush: { marginBlock: 0, borderBlockStartWidth: 0, paddingBlockStart: 0 },
  note: {
    margin: 0,
    color: color.textMuted,
    fontFamily: font.ui,
    fontSize: size.sm,
    marginBlockEnd: space.s2,
  },
  pair: {
    columnGap: space.s6,
    display: "none",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
  },
  pairFits: {
    display: {
      [WIDE]: { [FITS]: "grid", default: "none" },
      default: "none",
    },
  },
  pairAlways: { display: "grid" },
  merged: {
    display: {
      [WIDE]: { [FITS]: "none", default: "block" },
      default: "block",
    },
    marginBlockEnd: `calc(-1 * ${space.s2})`,
  },
  many: {
    columnGap: space.s6,
    display: "grid",
    gridTemplateColumns: `repeat(auto-fit, minmax(${COLUMN_WIDTH}, 1fr))`,
    rowGap: space.s3,
  },
  stack: { minInlineSize: 0 },
  columnLabel: {
    margin: 0,
    color: color.textMuted,
    fontFamily: font.ui,
    fontSize: size.sm,
    fontWeight: 600,
    marginBlockEnd: space.s1,
  },
  cell: {
    margin: 0,
    alignSelf: "start",
    columnGap: space.s1,
    display: "grid",
    gridTemplateColumns: {
      default: `${size.hang} minmax(0, 1fr)`,
      [media.phone]: `${size.hangSm} minmax(0, 1fr)`,
    },
    lineHeight: 1.65,
    marginBlockEnd: space.s2,
  },
  number: { fontVariantNumeric: "tabular-nums" },
  firstColumn: { gridColumn: 1 },
  secondColumn: { gridColumn: 2 },
  indent1: {
    paddingInlineStart: {
      default: size.hang,
      [media.phone]: size.hangSm,
    },
  },
  indent2: {
    paddingInlineStart: {
      default: `calc(2 * ${size.hang})`,
      [media.phone]: `calc(2 * ${size.hangSm})`,
    },
  },
  indent3: {
    paddingInlineStart: {
      default: `calc(3 * ${size.hang})`,
      [media.phone]: `calc(3 * ${size.hangSm})`,
    },
  },
  indent4: {
    paddingInlineStart: {
      default: `calc(4 * ${size.hang})`,
      [media.phone]: `calc(4 * ${size.hangSm})`,
    },
  },
  added: { margin: 0 },
  addedHeading: {
    margin: 0,
    fontFamily: font.ui,
    fontSize: size.md,
    marginBlockEnd: space.s1,
    marginBlockStart: space.s5,
  },
});

const markPaths = {
  ins: "M8 5.2v5.6M5.2 8h5.6",
  del: "M5.2 8h5.6",
} as const;

const markLabels = { ins: "disisipkan", del: "dihapus", mod: "diubah" };

export const MarkIcon = (props: { kind: Mark }) => (
  <svg
    class={css(styles[props.kind])}
    viewBox="0 0 16 16"
    width="14"
    height="14"
    role="img"
    aria-label={markLabels[props.kind]}
  >
    <rect
      x="2.5"
      y="2.5"
      width="11"
      height="11"
      rx="2"
      fill="none"
      stroke="currentColor"
      stroke-width="1.4"
    />
    <Show
      when={props.kind !== "mod"}
      fallback={
        <rect x="6" y="6" width="4" height="4" rx="0.8" fill="currentColor" />
      }
    >
      <path
        d={markPaths[props.kind === "ins" ? "ins" : "del"]}
        stroke="currentColor"
        stroke-width="1.4"
        stroke-linecap="round"
      />
    </Show>
  </svg>
);

/** What the marks in a comparison mean: the pasal marks of the contents and the text marks. */
export const Legend = () => (
  <p class={css(styles.legend)}>
    <span class={css(styles.legendItem)}>
      <MarkIcon kind="ins" />
      pasal disisipkan
    </span>
    <span class={css(styles.legendItem)}>
      <MarkIcon kind="del" />
      dihapus
    </span>
    <span class={css(styles.legendItem)}>
      <MarkIcon kind="mod" />
      diubah
    </span>
    <span class={css(styles.legendItem)}>
      <ins class={css(changes.ins)}>disisipkan</ins>{" "}
      <del class={css(changes.del)}>dihapus</del>{" "}
      <mark class={css(styles.modText)}>diubah</mark>{" "}
      <span class={css(styles.none)}>tidak ada padanan</span>
    </span>
  </p>
);

const PieceText = (props: { piece: Piece }) => (
  <Switch
    fallback={
      <mark
        class={css(
          styles.modText,
          props.piece.kind === "modOld" && styles.modOld
        )}
      >
        {props.piece.value}
      </mark>
    }
  >
    <Match when={props.piece.kind === "same"}>{props.piece.value}</Match>
    <Match when={props.piece.kind === "ins"}>
      <ins class={css(changes.ins)}>{props.piece.value}</ins>
    </Match>
    <Match when={props.piece.kind === "del"}>
      <del class={css(changes.del)}>{props.piece.value}</del>
    </Match>
    <Match when={props.piece.kind === "gone"}>
      <span class={css(styles.gone)}>{props.piece.value}</span>
    </Match>
    <Match when={props.piece.kind === "none"}>
      <span class={css(styles.none)}>tidak ada padanan</span>
    </Match>
  </Switch>
);

const indentStyle = (indent: number) => {
  if (indent <= 0) {
    return null;
  }

  return [styles.indent1, styles.indent2, styles.indent3, styles.indent4][
    Math.min(indent, 4) - 1
  ];
};

const Line = (props: {
  line: CompareLine;
  column?: 1 | 2;
  side: "left" | "right" | "one" | "stack";
}) => (
  <p
    class={css(
      styles.cell,
      props.column === 1 && styles.firstColumn,
      props.column === 2 && styles.secondColumn,
      indentStyle(props.line.indent),
      props.column !== undefined && slidingColumn(props.column - 1)
    )}
    data-cmp-column={props.column === undefined ? undefined : props.column - 1}
    data-side={props.side}
    data-kind={props.line.kind}
  >
    <span class={css(styles.number)}>{props.line.num ?? ""}</span>
    <span>
      <For each={props.line.pieces}>
        {(piece) => <PieceText piece={piece} />}
      </For>
    </span>
  </p>
);

/** The grid columns of a row of versions that scrolls sideways instead of giving way. */
export const columnsStyle = (count: number) => ({
  "column-gap": COLUMN_GAP,
  "grid-template-columns": `repeat(${count}, minmax(${COLUMN_WIDTH}, 1fr))`,
});

/** The width `count` columns need side by side. */
export const columnsWidth = (count: number) =>
  `calc(${count} * ${COLUMN_WIDTH} + ${count - 1} * ${COLUMN_GAP})`;

const Pair = (props: { row: CompareRow; fits: boolean }) => (
  <div
    class={css(styles.pair, props.fits ? styles.pairFits : styles.pairAlways)}
    style={props.fits ? undefined : columnsStyle(2)}
  >
    <For each={props.row.cells[0].lines}>
      {(line, index) => (
        <>
          <Line line={line} column={1} side="left" />
          <Show when={props.row.cells[1].lines[index()]}>
            {(other) => <Line line={other()} column={2} side="right" />}
          </Show>
        </>
      )}
    </For>
  </div>
);

const Stack = (props: {
  cell: CompareCell;
  column: number;
  label?: string;
}) => (
  <div
    class={css(styles.stack, slidingColumn(props.column))}
    data-cmp-column={props.column}
  >
    <Show when={isPresent(props.label)}>
      <p class={css(styles.columnLabel)}>{props.label}</p>
    </Show>
    <Show when={props.cell.state === "text"}>
      <For each={props.cell.lines}>
        {(line) => <Line line={line} side="stack" />}
      </For>
    </Show>
  </div>
);

/**
 * One pasal across the compared versions. Two versions sit side by side with their lines level
 * (paired by number), or as one merged run where the container is too narrow for two; more
 * versions are a column each. `fits` is true inside the reading view, where the container
 * decides; false in a row of columns that scrolls sideways, which always shows every column.
 */
export const PasalBlock = (props: {
  row: CompareRow;
  /** One name per column, shown over the columns when there are more than two. */
  labels: string[];
  fits: boolean;
}) => (
  <div
    class={css(
      styles.block,
      !props.fits && styles.flush,
      !props.fits && reading.law
    )}
    data-cmp-block
    data-mark={props.row.mark}
  >
    <Show when={isPresent(props.row.note)}>
      <p class={css(styles.note)}>{props.row.note}</p>
    </Show>
    <Show
      when={props.row.cells.length === 2}
      fallback={
        <div
          class={css(styles.many)}
          style={props.fits ? undefined : columnsStyle(props.row.cells.length)}
        >
          <For each={props.row.cells}>
            {(cell, index) => (
              <Stack
                cell={cell}
                column={index()}
                label={props.fits ? props.labels[index()] : undefined}
              />
            )}
          </For>
        </div>
      }
    >
      <Pair row={props.row} fits={props.fits} />
      <Show when={props.fits}>
        <div class={css(styles.merged)}>
          <For each={props.row.merged}>
            {(line) => <Line line={line} side="one" />}
          </For>
        </div>
      </Show>
    </Show>
  </div>
);

/** A changed pasal the text does not have, placed after the pasal before it. */
export const AddedPasal = (props: { row: CompareRow; labels: string[] }) => (
  <section
    id={`cmp-pasal-${props.row.key}`}
    data-num={props.row.num}
    data-compared
    class={css(styles.added)}
  >
    <h3 class={css(styles.addedHeading)}>Pasal {props.row.num}</h3>
    <PasalBlock row={props.row} labels={props.labels} fits />
  </section>
);
