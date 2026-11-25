import { For, Show } from "solid-js";

import { STATUS } from "../../../web/src/lib/labels.ts";
import type {
  DraftComparisonLine,
  DraftComparisonRow,
} from "../server/records/draft-comparison.ts";
import { css } from "../styles/css.ts";
import { linkStyles } from "../styles/link.ts";
import { reading } from "../styles/reading.ts";
import { synopsisStyles as styles } from "../styles/synopsis.ts";

type Side = "a" | "b";

type Kind = DraftComparisonLine["kind"];

const STATUS_STYLE = {
  sama: undefined,
  berubah: styles.statusBerubah,
  baru: styles.statusBaru,
  dihapus: styles.statusDihapus,
} as const;

const oldKindOf = (kind: Kind) => (kind === "diganti" ? "dihapus" : kind);
const newKindOf = (kind: Kind) => (kind === "diganti" ? "baru" : kind);

const memo = <Key extends string>(build: (key: Key) => string | undefined) => {
  const cache = new Map<Key, string | undefined>();

  return (key: Key) => {
    if (!cache.has(key)) {
      cache.set(key, build(key));
    }

    return cache.get(key);
  };
};

const oldLineClass = memo((kind: Kind) =>
  css(
    reading.law,
    styles.line,
    styles.sideLine,
    oldKindOf(kind) === "dihapus" && styles.removed,
    oldKindOf(kind) === "baru" && styles.ghost
  )
);

const newLineClass = memo((kind: Kind) =>
  css(
    reading.law,
    styles.line,
    styles.sideLine,
    newKindOf(kind) === "baru" && styles.added,
    newKindOf(kind) === "dihapus" && styles.ghost
  )
);

const inlineLineClass = memo((kind: Kind) =>
  css(
    reading.law,
    styles.line,
    styles.inlineLine,
    kind === "dihapus" && styles.removed,
    kind === "baru" && styles.added
  )
);

const insClass = css(styles.ins);
const delClass = css(styles.del);
const plainInsClass = css(styles.ins, styles.plainMark);
const plainDelClass = css(styles.del, styles.plainMark);
const numberClass = css(styles.number);
const struckNumberClass = css(styles.number, styles.strike);
const struckClass = css(styles.strike);
const textNumberedClass = css(styles.text);
const textFullClass = css(styles.textFull);
const referenceClass = css(styles.ref);
const referenceLinkClass = css(styles.refLink, linkStyles.base);

const Reference = (props: {
  line: DraftComparisonLine;
  versions: Record<Side, string>;
}) => (
  <Show when={props.line.ref} keyed>
    {(ref) => (
      <span class={referenceClass}>
        ≈{" "}
        <a class={referenceLinkClass} href={`#${ref.anchor}`} target="_self">
          {ref.label}
        </a>{" "}
        ({props.versions[ref.side]})
      </span>
    )}
  </Show>
);

const lineIndent = (line: DraftComparisonLine, side: Side) =>
  line[side]?.indent ?? (line.b ?? line.a)?.indent ?? 0;

const numberChanged = (line: DraftComparisonLine) =>
  line.a !== undefined && line.b !== undefined && line.a.num !== line.b.num;

const textClass = (numbered: boolean) =>
  numbered ? textNumberedClass : textFullClass;

const OldLine = (props: {
  line: DraftComparisonLine;
  versions: Record<Side, string>;
}) => {
  const kind = () => oldKindOf(props.line.kind);

  return (
    <div
      class={oldLineClass(props.line.kind)}
      style={{ "--i": lineIndent(props.line, "a") }}
    >
      <Show when={props.line.a?.num} keyed>
        {(num) => (
          <span class={numberClass}>
            {numberChanged(props.line) ? (
              <del class={delClass}>{num}</del>
            ) : (
              num
            )}
          </span>
        )}
      </Show>
      <span class={textClass(props.line.a?.num !== undefined)}>
        <Show when={kind() !== "baru"}>
          <For each={props.line.parts.filter((part) => !part.added)}>
            {(part) =>
              part.removed ? (
                <del class={kind() === "dihapus" ? plainDelClass : delClass}>
                  {part.value}
                </del>
              ) : (
                part.value
              )
            }
          </For>
        </Show>
        <Show when={props.line.kind === "dihapus"}>
          <Reference line={props.line} versions={props.versions} />
        </Show>
      </span>
    </div>
  );
};

const NewLine = (props: {
  line: DraftComparisonLine;
  versions: Record<Side, string>;
}) => {
  const kind = () => newKindOf(props.line.kind);

  return (
    <div
      class={newLineClass(props.line.kind)}
      style={{ "--i": lineIndent(props.line, "b") }}
    >
      <Show when={props.line.b?.num} keyed>
        {(num) => (
          <span class={numberClass}>
            {numberChanged(props.line) ? (
              <ins class={insClass}>{num}</ins>
            ) : (
              num
            )}
          </span>
        )}
      </Show>
      <span class={textClass(props.line.b?.num !== undefined)}>
        <Show when={kind() !== "dihapus"}>
          <For each={props.line.parts.filter((part) => !part.removed)}>
            {(part) =>
              part.added ? (
                <ins class={kind() === "baru" ? plainInsClass : insClass}>
                  {part.value}
                </ins>
              ) : (
                part.value
              )
            }
          </For>
        </Show>
        <Show when={props.line.kind === "baru"}>
          <Reference line={props.line} versions={props.versions} />
        </Show>
      </span>
    </div>
  );
};

const InlineLine = (props: {
  line: DraftComparisonLine;
  versions: Record<Side, string>;
}) => {
  const removed = () => props.line.kind === "dihapus";
  const number = () => (props.line.b ?? props.line.a)?.num;

  const plain = () => removed() || props.line.kind === "baru";
  const insMark = () => (plain() ? plainInsClass : insClass);
  const delMark = () => (plain() ? plainDelClass : delClass);

  return (
    <div
      class={inlineLineClass(props.line.kind)}
      style={{ "--i": lineIndent(props.line, "b") }}
    >
      <Show when={number()} keyed>
        {(num) => (
          <span class={removed() ? struckNumberClass : numberClass}>
            <Show when={numberChanged(props.line)} fallback={num}>
              <del class={delClass}>{props.line.a?.num}</del>{" "}
              <ins class={insClass}>{props.line.b?.num}</ins>
            </Show>
          </span>
        )}
      </Show>
      <span class={textClass(number() !== undefined)}>
        <span class={removed() ? struckClass : undefined}>
          <Show
            when={props.line.kind === "diganti"}
            fallback={
              <For each={props.line.parts}>
                {(part) => (
                  <Show when={part.added || part.removed} fallback={part.value}>
                    <Show
                      when={part.added}
                      fallback={<del class={delMark()}>{part.value}</del>}
                    >
                      <ins class={insMark()}>{part.value}</ins>
                    </Show>
                  </Show>
                )}
              </For>
            }
          >
            <del class={delMark()}>{props.line.parts[0]?.value}</del>
            <br />
            <ins class={insMark()}>{props.line.parts[1]?.value}</ins>
          </Show>
        </span>
        <Reference line={props.line} versions={props.versions} />
      </span>
    </div>
  );
};

const PasalHeading = (props: {
  pasal: { label: string } | undefined;
  version: string;
  missing: string;
  muted: boolean;
  hiddenOnPhone: boolean;
}) => (
  <div
    class={css(
      props.muted && styles.mutedCell,
      props.hiddenOnPhone && styles.hiddenOnPhone
    )}
  >
    <Show
      when={props.pasal}
      fallback={<p class={css(styles.none)}>{props.missing}</p>}
      keyed
    >
      {(pasal) => (
        <h3 class={css(styles.cellHeading)}>
          {pasal.label} <span class={css(styles.version)}>{props.version}</span>
        </h3>
      )}
    </Show>
  </div>
);

export const SynopsisRow = (props: {
  row: DraftComparisonRow;
  versions: Record<Side, string>;
}) => (
  <section
    id={props.row.anchor}
    class={css(
      styles.row,
      props.row.status === "sama" && !props.row.renumbered && styles.sameRow
    )}
  >
    <div class={css(styles.meta)}>
      <a
        class={css(
          styles.status,
          STATUS_STYLE[props.row.status],
          linkStyles.base
        )}
        href={`#${props.row.anchor}`}
        target="_self"
      >
        {STATUS[props.row.status]}
      </a>
      {props.row.moved && <span class={css(styles.tag)}>dipindah</span>}
      {props.row.status === "sama" && props.row.renumbered && (
        <span class={css(styles.tag)}>nomor berubah</span>
      )}
      {props.row.weak && (
        <span
          class={css(styles.tag)}
          title="Dicocokkan otomatis berdasarkan isi; kemiripannya rendah, periksa kedua teks."
        >
          kemiripan rendah
        </span>
      )}
    </div>
    <div class={css(styles.pair)}>
      <PasalHeading
        pasal={props.row.a}
        version={props.versions.a}
        missing="Tidak ada pada versi ini"
        muted={props.row.status === "baru"}
        hiddenOnPhone={props.row.status === "baru"}
      />
      <PasalHeading
        pasal={props.row.b}
        version={props.versions.b}
        missing="Dihapus"
        muted={props.row.status === "dihapus"}
        hiddenOnPhone={props.row.status === "dihapus"}
      />
      <For each={props.row.lines}>
        {(line) => (
          <>
            <OldLine line={line} versions={props.versions} />
            <NewLine line={line} versions={props.versions} />
            <InlineLine line={line} versions={props.versions} />
          </>
        )}
      </For>
    </div>
  </section>
);
