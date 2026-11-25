import * as stylex from "@stylexjs/stylex";
import { For, Match, Show, Switch } from "solid-js";

import { isPresent } from "../lib/text.ts";
import type {
  ChangedLine,
  ChangedPasal,
  Mark,
  Piece,
  VersionComparison,
} from "../server/law-comparison.ts";
import { css } from "../styles/css.ts";
import { linkClass, linkStyles } from "../styles/link.ts";
import { color, font, size, space } from "../styles/tokens.stylex.ts";
import { VersionPicker } from "./collection-version-picker.tsx";

const styles = stylex.create({
  bar: {
    paddingBlock: `${space.s3} ${space.s2}`,
    backgroundColor: color.background,
    borderBlockEndColor: color.line,
    borderBlockEndStyle: "solid",
    borderBlockEndWidth: 1,
    fontFamily: font.ui,
    fontSize: size.sm,
    marginBlockEnd: space.s5,
    position: { default: "sticky", "@media (max-width: 960px)": "static" },
    zIndex: 4,
    top: 0,
  },
  top: {
    gap: `${space.s1} ${space.s4}`,
    alignItems: "center",
    display: "flex",
    flexWrap: "wrap",
  },
  title: { fontSize: size.base, fontWeight: 600 },
  summary: { color: color.textMuted },
  only: {
    gap: space.s1,
    alignItems: "center",
    display: "inline-flex",
    marginInlineStart: "auto",
  },
  pickers: {
    gap: space.s3,
    alignItems: "center",
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    marginBlockStart: space.s3,
  },
  button: {
    font: "inherit",
    borderColor: color.lineStrong,
    borderRadius: size.radius,
    borderStyle: "solid",
    borderWidth: 1,
    paddingInline: space.s4,
    backgroundColor: color.background,
    color: color.link,
    cursor: "pointer",
    minBlockSize: size.tap,
  },
  swap: {
    borderColor: color.lineStrong,
    borderRadius: "50%",
    borderStyle: "solid",
    borderWidth: 1,
    placeItems: "center",
    textDecoration: "none",
    blockSize: space.s6,
    color: color.textMuted,
    display: "inline-grid",
    inlineSize: space.s6,
  },
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
  ins: { color: color.ok },
  del: { color: color.delText },
  mod: { color: color.warn },
  insText: {
    textDecoration: "none",
    backgroundColor: color.insBackground,
    color: color.insText,
  },
  delText: {
    backgroundColor: color.delBackground,
    color: color.delText,
  },
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
    fontSize: { default: "inherit", "@media (max-width: 960px)": size.base },
    paddingBlockStart: space.s3,
  },
  note: {
    margin: 0,
    color: color.textMuted,
    fontFamily: font.ui,
    fontSize: size.sm,
    marginBlockEnd: space.s2,
  },
  columns: {
    columnGap: space.s6,
    display: { default: "grid", "@media (max-width: 960px)": "none" },
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
  },
  inline: {
    display: { default: "none", "@media (max-width: 960px)": "block" },
  },
  cell: {
    margin: 0,
    alignSelf: "start",
    columnGap: space.s1,
    display: "grid",
    gridTemplateColumns: `${size.hang} minmax(0, 1fr)`,
    lineHeight: 1.65,
    marginBlockEnd: space.s2,
  },
  number: { fontVariantNumeric: "tabular-nums" },
  firstColumn: { gridColumn: 1 },
  secondColumn: { gridColumn: 2 },
  indent1: { paddingInlineStart: size.hang },
  indent2: { paddingInlineStart: `calc(2 * ${size.hang})` },
  indent3: { paddingInlineStart: `calc(3 * ${size.hang})` },
  indent4: { paddingInlineStart: `calc(4 * ${size.hang})` },
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

const Legend = () => (
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
      <ins class={css(styles.insText)}>disisipkan</ins>{" "}
      <del class={css(styles.delText)}>dihapus</del>{" "}
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
      <ins class={css(styles.insText)}>{props.piece.value}</ins>
    </Match>
    <Match when={props.piece.kind === "del"}>
      <del class={css(styles.delText)}>{props.piece.value}</del>
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

const Cell = (props: {
  num?: string;
  indent: number;
  pieces: Piece[];
  column?: 1 | 2;
  kind: string;
  side: string;
}) => (
  <p
    class={css(
      styles.cell,
      props.column === 1 && styles.firstColumn,
      props.column === 2 && styles.secondColumn,
      indentStyle(props.indent)
    )}
    data-side={props.side}
    data-kind={props.kind}
  >
    <span class={css(styles.number)}>{props.num ?? ""}</span>
    <span>
      <For each={props.pieces}>{(piece) => <PieceText piece={piece} />}</For>
    </span>
  </p>
);

const LineCells = (props: { line: ChangedLine; flipped: boolean }) => (
  <>
    <Cell
      num={props.line.oldNum}
      indent={props.line.indent}
      pieces={props.line.old}
      kind={props.line.kind}
      side="old"
      column={props.flipped ? 2 : 1}
    />
    <Cell
      num={props.line.newNum}
      indent={props.line.indent}
      pieces={props.line.new}
      kind={props.line.kind}
      side="new"
      column={props.flipped ? 1 : 2}
    />
  </>
);

export const PasalComparison = (props: {
  block: ChangedPasal;
  flipped: boolean;
}) => (
  <div class={css(styles.block)} data-cmp-block data-mark={props.block.mark}>
    <Show when={isPresent(props.block.note)}>
      <p class={css(styles.note)}>{props.block.note}</p>
    </Show>
    <div class={css(styles.columns)}>
      <For each={props.block.lines}>
        {(line) => <LineCells line={line} flipped={props.flipped} />}
      </For>
    </div>
    <div class={css(styles.inline)}>
      <For each={props.block.lines}>
        {(line) => (
          <Cell
            num={line.num}
            indent={line.indent}
            pieces={line.inline}
            kind={line.kind}
            side="one"
          />
        )}
      </For>
    </div>
  </div>
);

/** A changed pasal the text does not have, placed after the pasal before it. */
export const AddedPasal = (props: {
  block: ChangedPasal;
  flipped: boolean;
}) => (
  <section
    id={`cmp-pasal-${props.block.key}`}
    data-num={props.block.num}
    data-compared
    class={css(styles.added)}
  >
    <h3 class={css(styles.addedHeading)}>Pasal {props.block.num}</h3>
    <PasalComparison block={props.block} flipped={props.flipped} />
  </section>
);

export const CompareBar = (props: { comparison: VersionComparison }) => {
  const versions = () => props.comparison.versions;

  const choices = () =>
    versions().map(({ id, label, date }) => ({ id, label, date }));

  const left = () => props.comparison.left;
  const right = () => props.comparison.right;

  const summary = () =>
    props.comparison.older === props.comparison.newer
      ? "Dua versi yang sama."
      : `${props.comparison.changed.length} pasal berbeda`;

  return (
    <div class={css(styles.bar)} data-cmp-bar>
      <div class={css(styles.top)}>
        <span class={css(styles.title)}>Bandingkan versi</span>
        <output class={css(styles.summary)}>{summary()}</output>
        <label class={css(styles.only)}>
          <input type="checkbox" data-cmp-only /> Yang berubah saja
        </label>
        <a class={linkClass} href="./" target="_self">
          Tutup
        </a>
      </div>
      <form class={css(styles.pickers)} method="get" action="./">
        <VersionPicker
          name="dari"
          label="Versi di kolom kiri"
          versions={choices()}
          value={versions()[left()].id}
        />
        <a
          class={css(styles.swap, linkStyles.base)}
          href={`?bandingkan=${versions()[left()].id}&dari=${versions()[right()].id}`}
          aria-label="Tukar kolom kiri dan kanan"
          title="Tukar kolom"
        >
          ⇄
        </a>
        <VersionPicker
          name="bandingkan"
          label="Versi di kolom kanan"
          versions={choices()}
          value={versions()[right()].id}
        />
        <button type="submit" class={css(styles.button)}>
          Bandingkan
        </button>
      </form>
      <Legend />
    </div>
  );
};
