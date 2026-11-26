import { useLocation, useNavigate } from "@solidjs/router";
import * as stylex from "@stylexjs/stylex";
import { Input, InputClear, InputGroup } from "@ui-sdk/solid/input";
import { createSignal, For, isPending, Show } from "solid-js";
import * as v from "valibot";

import type {
  ChangedLine,
  CollectionCompareView,
  ColumnCell,
  VersionChoice,
} from "../lib/collection-compare.ts";
import { pasalKey } from "../lib/display.ts";
import { compareSearch } from "../lib/schemas.ts";
import { changes } from "../styles/changes.ts";
import { css } from "../styles/css.ts";
import { linkStyles } from "../styles/link.ts";
import { motion } from "../styles/motion.stylex.ts";
import { reading } from "../styles/reading.ts";
import { color, media, shadow, size, space } from "../styles/tokens.stylex.ts";
import { versionName, VersionPicker } from "./collection-version-picker.tsx";
import { Grip, Handle, Root, SlidingColumn } from "./column-parts.tsx";

const GRABBED = ":is([data-grabbed])";
const NO_SCRIPT = "@media (scripting: none)";
const SCRIPTED = "@media (scripting: enabled)";
const MIN_COLUMNS = 2;
const COLUMN_WIDTH = "17rem";
const SEPARATOR = ",";
const LEADING_PASAL = /^PASAL\s*/u;

const styles = stylex.create({
  top: {
    gap: space.s3,
    alignItems: "center",
    display: "flex",
    justifyContent: "space-between",
  },
  heading: { margin: 0 },
  close: {
    font: "inherit",
    borderColor: color.lineStrong,
    borderRadius: size.radius,
    borderStyle: "solid",
    borderWidth: 1,
    paddingBlock: space.s1,
    paddingInline: space.s3,
    textDecoration: "none",
    alignItems: "center",
    display: "inline-flex",
    minBlockSize: space.s6,
  },
  help: { maxInlineSize: size.measure },
  muted: { color: color.textMuted },
  bar: {
    padding: space.s3,
    borderColor: color.line,
    borderRadius: size.radiusMd,
    borderStyle: "solid",
    borderWidth: 1,
    gap: space.s2,
    alignItems: "center",
    backgroundColor: color.backgroundSubtle,
    display: "flex",
    flexWrap: "wrap",
  },
  slots: {
    gap: space.s2,
    alignItems: "center",
    display: "flex",
    flexWrap: "wrap",
  },
  slot: {
    padding: space.s1,
    borderColor: color.lineStrong,
    borderRadius: size.radius,
    borderStyle: "solid",
    borderWidth: 1,
    gap: space.s1,
    transition: {
      default: motion.liftTransition,
      [motion.reduced]: "none",
    },
    alignItems: "center",
    backgroundColor: color.background,
    boxShadow: { [GRABBED]: shadow.pop, default: null },
    display: "flex",
    minBlockSize: size.tap,
    position: "relative",
    scale: { [GRABBED]: 1.04, default: 1 },
    transform: {
      [GRABBED]: "translate(var(--drag-x, 0), var(--drag-y, 0))",
      default: null,
    },
    userSelect: "none",
    zIndex: { [GRABBED]: 3, default: null },
  },
  handle: {
    padding: 0,
    borderRadius: size.radius,
    borderWidth: 0,
    placeItems: "center",
    backgroundColor: "transparent",
    blockSize: space.s6,
    color: color.textMuted,
    cursor: { default: "grab", ":active": "grabbing" },
    display: { [NO_SCRIPT]: "none", default: "grid" },
    inlineSize: space.s4,
    outlineColor: color.link,
    outlineOffset: 2,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: 3,
    touchAction: "none",
  },
  remove: {
    borderRadius: size.radius,
    placeItems: "center",
    textDecoration: "none",
    backgroundColor: { default: null, ":hover": color.delBackground },
    blockSize: size.tap,
    color: { default: color.textMuted, ":hover": color.delText },
    display: "grid",
    fontSize: size.lg,
    inlineSize: size.tap,
  },
  add: {
    borderColor: color.link,
    borderRadius: size.radius,
    borderStyle: "dashed",
    borderWidth: 1,
    paddingInline: space.s3,
    textDecoration: "none",
    alignItems: "center",
    display: "inline-flex",
    fontSize: size.sm,
    fontWeight: 600,
    minBlockSize: size.tap,
  },
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
  submit: {
    font: "inherit",
    borderColor: color.lineStrong,
    borderRadius: size.radius,
    borderStyle: "solid",
    borderWidth: 1,
    paddingInline: space.s4,
    backgroundColor: color.background,
    color: color.link,
    cursor: "pointer",
    display: { [SCRIPTED]: "none", default: "block" },
    minBlockSize: size.tap,
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
  summary: { margin: 0, color: color.textMuted, fontSize: size.sm },
  grid: {
    transition: "opacity 0.15s ease",
    overflowX: "auto",
  },
  busy: { opacity: 0.6 },
  head: {
    paddingBlock: space.s2,
    borderBlockEndColor: color.line,
    borderBlockEndStyle: "solid",
    borderBlockEndWidth: 2,
    columnGap: space.s4,
    display: { default: "grid", [media.phone]: "none" },
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
  cells: {
    columnGap: space.s4,
    display: { default: "grid", [media.phone]: "block" },
  },
  cell: { minInlineSize: 0 },
  cellLabel: {
    marginBlock: `${space.s2} ${space.s1}`,
    color: color.textMuted,
    display: { default: "none", [media.phone]: "block" },
    fontSize: size.xs,
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  placeholder: {
    margin: 0,
    color: color.textMuted,
    fontStyle: "italic",
  },
  line: {
    marginBlock: `0 ${space.s2}`,
    columnGap: "0.3rem",
    display: "grid",
    gridTemplateColumns: `minmax(${size.hang}, max-content) minmax(0, 1fr)`,
    lineHeight: 1.6,
  },
  indent1: { marginInlineStart: size.hang },
  indent2: { marginInlineStart: `calc(2 * ${size.hang})` },
  indent3: { marginInlineStart: `calc(3 * ${size.hang})` },
});

const placeholders = {
  deleted: "Dihapus",
  unreadable: "Teks belum terbaca dari PDF",
  absent: "Belum ada",
} as const;

const indents = [undefined, styles.indent1, styles.indent2, styles.indent3];

const normalized = (text: string) =>
  text.trim().toUpperCase().replace(LEADING_PASAL, "");

const searchOf = (ids: string[], pasal: string) => {
  const query = new URLSearchParams();

  query.set("v", ids.join(SEPARATOR));

  if (pasal !== "") {
    query.set("pasal", pasal);
  }

  return `?${query.toString().replaceAll("%2C", SEPARATOR)}#banding`;
};

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
export const firstToLatestHref = (comparison: CollectionCompareView) =>
  searchOf(
    [comparison.versions[0]?.id ?? "", comparison.versions.at(-1)?.id ?? ""],
    ""
  );

const Line = (props: { line: ChangedLine }) => (
  <p
    class={css(
      reading.law,
      styles.line,
      indents[Math.min(props.line.indent, 3)]
    )}
  >
    <span>{props.line.num}</span>
    <span>
      <For each={props.line.parts}>
        {(part) => {
          if (part.added) {
            return <ins class={css(changes.ins)}>{part.value}</ins>;
          }

          return part.removed ? (
            <del class={css(changes.del)}>{part.value}</del>
          ) : (
            part.value
          );
        }}
      </For>
    </span>
  </p>
);

const Cell = (props: { cell: ColumnCell; label: string }) => (
  <div class={css(styles.cell)}>
    <span class={css(styles.cellLabel)}>{props.label}</span>
    <Show
      when={props.cell.state === "text"}
      fallback={
        <p class={css(styles.placeholder)}>
          {props.cell.state === "text" ? "" : placeholders[props.cell.state]}
        </p>
      }
    >
      <For each={props.cell.lines}>{(line) => <Line line={line} />}</For>
    </Show>
  </div>
);

const columnKeys = (ids: string[]) =>
  ids.map((id, index) => (ids.indexOf(id) === index ? id : `${id}~${index}`));

const rowStyle = (count: number) => ({
  "grid-template-columns": `repeat(${count}, minmax(${COLUMN_WIDTH}, 1fr))`,
});

const nextVersion = (versions: VersionChoice[], ids: string[]) => {
  const last = versions.findIndex((entry) => entry.id === ids.at(-1));

  return (
    versions.find((entry, index) => index > last && !ids.includes(entry.id)) ??
    versions.find((entry) => !ids.includes(entry.id))
  );
};

const Presets = (props: { versions: VersionChoice[]; pasal: string }) => {
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
            href={searchOf(preset.ids, props.pasal)}
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

const ColumnBar = (props: {
  versions: VersionChoice[];
  ids: string[];
  pasal: string;
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const keys = () => columnKeys(props.ids);
  const [order, setOrder] = createSignal<string[]>(() => keys());

  const idOf = (key: string) => props.ids[keys().indexOf(key)] ?? key;

  const citeOf = (id: string) =>
    props.versions.find((entry) => entry.id === id)?.cite ?? id;

  const labels = () =>
    Object.fromEntries(keys().map((key) => [key, citeOf(idOf(key))]));

  const open = (ids: string[]) => {
    navigate(`${location.pathname}${searchOf(ids, props.pasal)}`);
  };

  const without = (index: number) =>
    props.ids.filter((_id, position) => position !== index);

  const addition = () => nextVersion(props.versions, props.ids);

  return (
    <div class={css(styles.bar)}>
      <Root
        class={css(styles.slots)}
        aria-label="Versi yang dibandingkan"
        orientation="grid"
        value={order()}
        labels={labels()}
        onValueChange={(next) => {
          setOrder(next);

          setTimeout(() => {
            open(next.map(idOf));
          }, 0);
        }}
      >
        {(state) => (
          <For each={state.order}>
            {(key, index) => (
              <SlidingColumn
                slot={key}
                order={state.order.join(SEPARATOR)}
                versions={props.ids.join(SEPARATOR)}
                class={css(styles.slot)}
              >
                <Handle
                  value={key}
                  class={css(styles.handle)}
                  aria-label={`Pindahkan kolom ${citeOf(idOf(key))}`}
                  title="Geser untuk mengubah urutan kolom"
                >
                  <Grip />
                </Handle>
                <VersionPicker
                  name="v"
                  label={`Versi kolom ${index() + 1}`}
                  versions={props.versions}
                  value={idOf(key)}
                  onPick={(id) => {
                    open(
                      props.ids.map((current, position) =>
                        position === keys().indexOf(key) ? id : current
                      )
                    );
                  }}
                />
                <Show when={props.ids.length > MIN_COLUMNS}>
                  <a
                    class={css(linkStyles.base, styles.remove)}
                    href={searchOf(without(keys().indexOf(key)), props.pasal)}
                    aria-label={`Hapus kolom ${citeOf(idOf(key))}`}
                    title="Hapus kolom"
                  >
                    ×
                  </a>
                </Show>
              </SlidingColumn>
            )}
          </For>
        )}
      </Root>
      <Show when={addition()}>
        {(next) => (
          <a
            class={css(linkStyles.base, styles.add)}
            href={searchOf([...props.ids, next().id], props.pasal)}
          >
            + Tambah versi
          </a>
        )}
      </Show>
    </div>
  );
};

const Summary = (props: { count: number; columns: number; pasal: string }) => {
  const text = () => {
    if (props.pasal === "") {
      return `${props.count} pasal berbeda di antara ${props.columns} versi ini.`;
    }

    return props.count > 0
      ? `Pasal ${props.pasal} dalam ${props.columns} versi.`
      : `Pasal ${props.pasal} tidak berubah di antara perubahan yang kami punya.`;
  };

  return (
    <p class={css(styles.summary)} aria-live="polite">
      {text()}
    </p>
  );
};

const Grid = (props: {
  comparison: CollectionCompareView;
  pasal: string;
  busy: boolean;
}) => {
  const columns = () =>
    props.comparison.chosen.flatMap(
      (id) => props.comparison.versions.find((entry) => entry.id === id) ?? []
    );

  const rows = () =>
    props.pasal === ""
      ? props.comparison.rows
      : props.comparison.rows.filter(
          (row) => row.num.toUpperCase() === props.pasal
        );

  return (
    <>
      <Summary
        count={rows().length}
        columns={props.comparison.chosen.length}
        pasal={props.pasal}
      />
      <Show when={props.comparison.gap > 0}>
        <p class={css(styles.note)}>
          Ada {props.comparison.gap} perubahan di antara versi-versi ini yang
          belum tercatat (biasanya melalui UU Cipta Kerja); pasal yang diubah
          olehnya tidak tampak di sini.
        </p>
      </Show>
      <section
        class={css(styles.grid, props.busy && styles.busy)}
        aria-label="Pasal yang berbeda, satu kolom tiap versi"
      >
        <div
          class={css(styles.head)}
          style={rowStyle(props.comparison.chosen.length)}
          aria-hidden="true"
        >
          <For each={columns()} keyed={false}>
            {(version) => <strong>{versionName(version())}</strong>}
          </For>
        </div>
        <For each={rows()} keyed={(row) => row.num}>
          {(row) => (
            <section
              id={`banding-${pasalKey(row().num)}`}
              class={css(styles.row)}
              aria-label={`Pasal ${row().num}`}
            >
              <h3 class={css(styles.title)} aria-hidden="true">
                Pasal {row().num}
              </h3>
              <div
                class={css(styles.cells)}
                style={rowStyle(row().cells.length)}
              >
                <For each={row().cells} keyed={false}>
                  {(cell, index) => (
                    <Cell cell={cell()} label={columns()[index]?.cite ?? ""} />
                  )}
                </For>
              </div>
            </section>
          )}
        </For>
      </section>
    </>
  );
};

/**
 * Compare any number of versions of a collection side by side: one column per version, each
 * marking what changed since the column to its left. The reader adds and removes columns,
 * drags them (or moves them with the keys) into another order, picks the versions, takes a
 * quick choice and narrows the rows to one pasal. The choice lives in the address
 * (`?v=a,b,c&pasal=5`), so a view can be shared and every control is a link or a field of one
 * GET form, which works without a script; the pasal that differ are built by the server.
 */
export const CollectionCompare = (props: {
  comparison: CollectionCompareView;
  onDemand?: boolean;
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

  const shown = () =>
    props.onDemand !== true ||
    props.comparison.chosen.length > 0 ||
    props.comparison.unknown;

  return (
    <Show when={shown()}>
      <section
        id="banding"
        aria-labelledby="banding-title"
        aria-busy={pending() ? "true" : "false"}
      >
        <div class={css(styles.top)}>
          <h2 id="banding-title" class={css(styles.heading)}>
            Bandingkan versi
          </h2>
          <Show when={props.onDemand}>
            <a
              class={css(linkStyles.base, styles.close)}
              href="./"
              target="_self"
            >
              Tutup
            </a>
          </Show>
        </div>
        <p class={css(styles.help)}>
          Pilih versi yang ingin dibandingkan. Tambah atau hapus kolom, geser
          untuk mengubah urutan. Tiap kolom menandai yang{" "}
          <ins class={css(changes.ins)}>baru</ins> dan yang{" "}
          <del class={css(changes.del)}>dihapus</del> dibanding kolom di
          kirinya.
        </p>
        <form method="get" action="#banding">
          <ColumnBar versions={versions()} ids={ids()} pasal={pasal()} />
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
          <button type="submit" class={css(styles.submit)}>
            Bandingkan
          </button>
        </form>
        <Show when={props.comparison.unknown}>
          <output>Versi yang diminta tidak dikenal di koleksi ini.</output>
        </Show>
        <Show when={props.comparison.chosen.length > 0}>
          <Grid
            comparison={props.comparison}
            pasal={pasal()}
            busy={pending()}
          />
        </Show>
      </section>
    </Show>
  );
};
