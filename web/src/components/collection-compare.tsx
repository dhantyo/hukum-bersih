import { useLocation } from "@solidjs/router";
import * as stylex from "@stylexjs/stylex";
import { Input, InputClear, InputGroup } from "@ui-sdk/solid/input";
import { createSignal, For, isPending, Show } from "solid-js";
import * as v from "valibot";

import { spanEntries } from "../lib/compare-span.ts";
import type { SpanEntry } from "../lib/compare-span.ts";
import type { Comparison } from "../lib/compare.ts";
import { compareSearch } from "../lib/schemas.ts";
import type { ReaderText } from "../server/records/reader-text.ts";
import { slidingColumn } from "../styles/column-slide.ts";
import { css } from "../styles/css.ts";
import { linkStyles } from "../styles/link.ts";
import { color, size, space } from "../styles/tokens.stylex.ts";
import { versionName } from "./collection-version-picker.tsx";
import { columnsHref, CompareBar } from "./compare-bar.tsx";
import { columnsStyle, columnsWidth, PasalBlock } from "./compare-block.tsx";
import { ComparisonFailure } from "./comparison-failure.tsx";
import { ScrollRow } from "./scroll-row.tsx";
import { UnchangedRun } from "./unchanged-run.tsx";

const LEADING_PASAL = /^PASAL\s*/u;

const styles = stylex.create({
  muted: { color: color.textMuted },
  tools: {
    gap: `${space.s2} ${space.s4}`,
    marginBlock: space.s3,
    alignItems: "center",
    display: "flex",
    flexWrap: "wrap",
    fontSize: size.sm,
    justifyContent: "space-between",
  },
  presets: {
    margin: 0,
    gap: space.s2,
    alignItems: "center",
    display: "flex",
    flexWrap: "wrap",
  },
  preset: {
    borderColor: {
      default: color.lineStrong,
      ":hover": color.link,
    },
    borderRadius: 999,
    borderStyle: "solid",
    borderWidth: 1,
    paddingBlock: "0.2rem",
    paddingInline: space.s3,
    textDecoration: "none",
    color: color.text,
  },
  find: {
    gap: space.s2,
    alignItems: "center",
    display: "flex",
  },
  findGroup: { position: "relative" },
  findInput: {
    font: "inherit",
    borderColor: color.lineStrong,
    borderRadius: size.radius,
    borderStyle: "solid",
    borderWidth: 1,
    paddingBlock: space.s1,
    appearance: "none",
    backgroundColor: color.background,
    boxSizing: "border-box",
    color: color.text,
    inlineSize: "11rem",
    outlineColor: color.link,
    outlineOffset: { default: null, ":focus-visible": 1 },
    outlineStyle: { default: null, ":focus-visible": "solid" },
    outlineWidth: { default: null, ":focus-visible": 2 },
    paddingInlineEnd: size.tap,
    paddingInlineStart: space.s2,
    "::-webkit-search-cancel-button": { display: "none" },
    "::placeholder": { color: color.textMuted },
  },
  findClear: {
    padding: 0,
    borderWidth: 0,
    insetBlock: 0,
    alignItems: "center",
    backgroundColor: "transparent",
    color: color.link,
    cursor: "pointer",
    display: "flex",
    inlineSize: size.tap,
    insetInlineEnd: 0,
    justifyContent: "center",
    position: "absolute",
  },
  note: {
    padding: `${space.s2} ${space.s3}`,
    borderColor: color.warn,
    borderRadius: size.radiusMd,
    borderStyle: "solid",
    borderWidth: 1,
    fontSize: size.sm,
    maxInlineSize: size.measure,
  },
  grid: { transition: "opacity 0.15s ease" },
  busy: { opacity: 0.6 },
  head: {
    paddingBlock: space.s2,
    borderBlockEndColor: color.line,
    borderBlockEndStyle: "solid",
    borderBlockEndWidth: 2,
    display: "grid",
    fontSize: size.sm,
  },
  row: {
    containIntrinsicSize: "auto 12rem",
    paddingBlock: space.s3,
    borderBlockEndColor: color.line,
    borderBlockEndStyle: "solid",
    borderBlockEndWidth: 1,
    contentVisibility: "auto",
  },
  title: { marginBlock: `0 ${space.s2}`, fontSize: size.base },
});

const normalized = (text: string) =>
  text.trim().toUpperCase().replace(LEADING_PASAL, "");

const remember = (text: string) => {
  const url = new URL(window.location.href);

  if (normalized(text) === "") {
    url.searchParams.delete("pasal");
  } else {
    url.searchParams.set("pasal", normalized(text));
  }

  window.history.replaceState(window.history.state, "", url);
};

/** Where the "Bandingkan versi" button of the side panel leads: the first version against the
 * latest. */
export const firstToLatestHref = (comparison: Comparison) =>
  columnsHref(
    [comparison.versions[0]?.id ?? "", comparison.versions.at(-1)?.id ?? ""],
    ""
  );

const Presets = (props: {
  versions: Comparison["versions"];
  pasal: string;
}) => {
  const ids = () => props.versions.map((entry) => entry.id);

  const presets = () => [
    {
      label: "Asli dan terbaru",
      ids: [ids()[0] ?? "", ids().at(-1) ?? ""],
    },
    { label: "Semua versi", ids: ids() },
    { label: "Perubahan terakhir", ids: ids().slice(-2) },
  ];

  return (
    <p class={css(styles.presets)}>
      <span class={css(styles.muted)}>Cepat:</span>
      <For each={presets()}>
        {(preset) => (
          <a
            class={css(linkStyles.base, styles.preset)}
            href={columnsHref(preset.ids, props.pasal)}
          >
            {preset.label}
          </a>
        )}
      </For>
    </p>
  );
};

const PasalFilter = (props: {
  value: string;
  onValueChange: (text: string) => void;
}) => (
  <label class={css(styles.find)}>
    Pasal
    <InputGroup class={css(styles.findGroup)}>
      <Input
        type="search"
        name="pasal"
        placeholder="mis. 5 atau 17A"
        autocomplete="off"
        class={css(styles.findInput)}
        value={props.value}
        onValueChange={(text) => {
          props.onValueChange(text);
        }}
      />
      <InputClear aria-label="Hapus filter pasal" class={css(styles.findClear)}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path
            d="M4 4l8 8M12 4l-8 8"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
          />
        </svg>
      </InputClear>
    </InputGroup>
  </label>
);

const summaryOf = (count: number, columns: number, pasal: string) => {
  if (pasal === "") {
    return `${count} pasal berbeda di antara ${columns} versi ini.`;
  }

  return count > 0
    ? `Pasal ${pasal} dalam ${columns} versi.`
    : `Pasal ${pasal} tidak berubah di antara perubahan yang kami punya.`;
};

const changedRow = (entry: SpanEntry) =>
  entry.kind === "changed" ? entry.row : undefined;

const sameRun = (entry: SpanEntry) =>
  entry.kind === "same" ? entry.pasal : undefined;

const GridEntry = (props: { entry: SpanEntry }) => (
  <>
    <Show when={changedRow(props.entry)}>
      {(row) => (
        <section
          id={`pasal-${row().key}`}
          class={css(styles.row)}
          aria-label={`Pasal ${row().num}`}
        >
          <h3 class={css(styles.title)} aria-hidden="true">
            Pasal {row().num}
          </h3>
          <PasalBlock row={row()} labels={[]} fits={false} />
        </section>
      )}
    </Show>
    <Show when={sameRun(props.entry)}>
      {(pasal) => <UnchangedRun pasal={pasal()} />}
    </Show>
  </>
);

const Grid = (props: {
  comparison: Comparison;
  entries: SpanEntry[];
  busy: boolean;
}) => {
  const columns = () =>
    props.comparison.chosen.flatMap(
      (id) => props.comparison.versions.find((entry) => entry.id === id) ?? []
    );

  return (
    <>
      <Show when={props.comparison.gap > 0}>
        <p class={css(styles.note)}>
          Ada {props.comparison.gap} perubahan di antara versi-versi ini yang
          belum tercatat (biasanya melalui UU Cipta Kerja); pasal yang diubah
          olehnya tidak tampak di sini.
        </p>
      </Show>
      <ScrollRow
        class={css(styles.grid, props.busy && styles.busy)}
        label="Pasal tiap versi, satu kolom tiap versi"
        minWidth={columnsWidth(props.comparison.chosen.length)}
        head={() => (
          <div
            class={css(styles.head)}
            style={columnsStyle(props.comparison.chosen.length)}
          >
            <For each={columns()} keyed={false}>
              {(version, index) => (
                <strong
                  class={css(slidingColumn(index))}
                  data-cmp-column={index}
                >
                  {versionName(version())}
                </strong>
              )}
            </For>
          </div>
        )}
      >
        <For each={props.entries}>{(entry) => <GridEntry entry={entry} />}</For>
      </ScrollRow>
    </>
  );
};

/**
 * Compare any number of versions of a collection, a pasal at a time: one column per version,
 * marked against its neighbour. The reader changes the columns in the shared bar, takes a quick
 * choice and narrows the rows to one pasal. The choice lives in the address
 * (`?v=a,b,c&pasal=5`), so a view can be shared and every control is a link or a field of one
 * GET form, which works without a script. A visit to the address gets the pasal that differ from
 * the server; a change made on the page builds them in the browser from the published files.
 */
export const CollectionCompare = (props: {
  comparison: Comparison;
  onDemand?: boolean;
  /** The text of one of the compared versions; the pasal of it that no row names are shown as
   * unchanged. Without it only the pasal that differ are listed. */
  text?: ReaderText;
}) => {
  const location = useLocation();

  const [typed, setTyped] = createSignal(
    () => v.parse(compareSearch, location.query).pasal ?? ""
  );

  const pasal = () => normalized(typed());
  const pending = () => isPending(() => props.comparison);
  const versions = () => props.comparison.versions;
  const first = () => versions()[0]?.id ?? "";
  const last = () => versions().at(-1)?.id ?? first();

  const ids = () =>
    props.comparison.chosen.length > 0
      ? props.comparison.chosen
      : [first(), last()];

  const entries = () => spanEntries(props.comparison.rows, props.text, pasal());

  const counted = () =>
    entries().filter((entry) => pasal() !== "" || entry.kind === "changed")
      .length;

  const shown = () => props.onDemand !== true || props.comparison.requested;

  return (
    <Show when={shown()}>
      <div aria-busy={pending() ? "true" : "false"}>
        <CompareBar
          versions={versions()}
          ids={ids()}
          href={(next) => columnsHref(next, pasal())}
          action="./"
          summary={
            props.comparison.chosen.length > 0
              ? summaryOf(counted(), props.comparison.chosen.length, pasal())
              : ""
          }
          closable={props.onDemand}
          onlyChanged={props.text !== undefined}
        >
          <div class={css(styles.tools)}>
            <Presets versions={versions()} pasal={pasal()} />
            <PasalFilter
              value={typed()}
              onValueChange={(text) => {
                setTyped(text);
                remember(text);
              }}
            />
          </div>
        </CompareBar>
        <ComparisonFailure comparison={props.comparison} />
        <Show when={props.comparison.unknown}>
          <output>Versi yang diminta tidak dikenal di koleksi ini.</output>
        </Show>
        <Show when={props.comparison.chosen.length > 0}>
          <Grid
            comparison={props.comparison}
            entries={entries()}
            busy={pending()}
          />
        </Show>
      </div>
    </Show>
  );
};
