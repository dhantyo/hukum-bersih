import type { JSX } from "@solidjs/web";
import * as stylex from "@stylexjs/stylex";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@ui-sdk/solid/popover";
import { Preferences, usePreference } from "@ui-sdk/solid/preferences";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@ui-sdk/solid/segmented-control";
import { For, Show } from "solid-js";

import {
  cukupJelas,
  fontAsli,
  fontModern,
  format,
  parts,
  penjelasan,
  readingPreferences,
  size as sizePreference,
} from "../lib/reading-preferences.ts";
import type { ReaderText } from "../server/records/reader-text.ts";
import { css } from "../styles/css.ts";
import { reading } from "../styles/reading.ts";
import { color, font, size, space, shadow } from "../styles/tokens.stylex.ts";
import { accessibility } from "../styles/visually-hidden.ts";
import { LabelledCheckbox } from "./labelled-checkbox.tsx";

const checked = ":is([data-checked])";

const styles = stylex.create({
  trigger: {
    borderColor: color.lineStrong,
    borderRadius: size.radius,
    borderStyle: "solid",
    borderWidth: 1,
    placeItems: "center",
    backgroundColor: color.background,
    color: color.text,
    cursor: "pointer",
    display: "grid",
    fontFamily: font.ui,
    fontWeight: 600,
    minHeight: size.tap,
    minWidth: size.tap,
  },
  pop: {
    padding: space.s4,
    borderColor: color.line,
    borderRadius: size.radiusMd,
    borderStyle: "solid",
    borderWidth: 1,
    backgroundColor: color.surface,
    boxShadow: shadow.pop,
    boxSizing: "border-box",
    color: color.text,
    inlineSize: "min(23rem, calc(100vw - 2rem))",
    maxBlockSize: "var(--available-height)",
    overflowY: "auto",
  },
  fieldset: {
    margin: 0,
    padding: 0,
    borderWidth: 0,
    marginBlockEnd: space.s4,
    minInlineSize: 0,
  },
  legend: {
    padding: 0,
    color: color.textMuted,
    fontSize: size.xs,
    fontWeight: 600,
    letterSpacing: "0.06em",
    marginBlockEnd: space.s2,
    textTransform: "uppercase",
  },
  group: { gap: space.s2, display: "flex", flexWrap: "wrap" },
  stack: { gap: space.s1, display: "grid" },
  item: {
    padding: `${space.s1} ${space.s3}`,
    borderColor: { [checked]: color.link, default: color.lineStrong },
    borderRadius: 999,
    borderStyle: "solid",
    borderWidth: 1,
    backgroundColor: {
      [checked]: color.linkBackground,
      default: "transparent",
    },
    color: color.text,
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: size.sm,
    minBlockSize: size.tap,
  },
  option: {
    padding: space.s2,
    borderRadius: size.radius,
    borderWidth: 0,
    backgroundColor: {
      [checked]: color.linkBackground,
      default: "transparent",
    },
    color: color.text,
    cursor: "pointer",
    display: "grid",
    fontFamily: "inherit",
    fontSize: "inherit",
    textAlign: "start",
  },
  note: { color: color.textMuted, fontSize: size.xs },
  preview: {
    margin: 0,
    borderBlockStartColor: color.line,
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: 1,
    paddingBlockStart: space.s3,
  },
});

const formatOptions = [
  ["modern", "Modern", "untuk layar: judul huruf biasa, Pembukaan dilipat"],
  ["asli", "Asli", "seperti salinan resmi: judul rata tengah, kapital"],
] as const;

const fontOptions = [
  ["serif", "Source Serif", "serif, bawaan format Asli"],
  ["literata", "Literata", "serif buku"],
  ["sans", "Public Sans", "tanpa kait"],
  [
    "atkinson",
    "Atkinson Hyperlegible",
    "paling mudah dibaca, bawaan format Modern",
  ],
] as const;

const placementOptions = [
  ["akhir", "Di akhir"],
  ["pasal", "Per pasal"],
  ["sembunyi", "Sembunyi"],
] as const;

const sizeOptions = [
  ["normal", "Normal"],
  ["large", "Besar"],
] as const;

const partLabels = {
  pembukaan: "Pembukaan",
  batang: "Batang tubuh",
  penutup: "Penutup",
} as const;

const Fieldset = (props: { legend: JSX.Element; children: JSX.Element }) => (
  <fieldset class={css(styles.fieldset)}>
    <legend class={css(styles.legend)}>{props.legend}</legend>
    {props.children}
  </fieldset>
);

type Option = readonly [value: string, label: string, note?: string];

const ChoiceGroup = (props: {
  label: string;
  value: string;
  options: readonly Option[];
  rows?: boolean;
  onPick: (value: string) => void;
}) => (
  <SegmentedControl
    class={css(props.rows === true ? styles.stack : styles.group)}
    aria-label={props.label}
    value={props.value}
    onValueChange={(next) => {
      if (next !== null) {
        props.onPick(next);
      }
    }}
  >
    <For each={props.options}>
      {([value, label, note]) => (
        <SegmentedControlItem
          value={value}
          class={css(props.rows === true ? styles.option : styles.item)}
        >
          <span>{label}</span>
          <Show when={note}>
            <span class={css(styles.note)}>{note}</span>
          </Show>
        </SegmentedControlItem>
      )}
    </For>
  </SegmentedControl>
);

const showOrHide = (shown: boolean) => (shown ? "show" : "hide");

const FormatChoice = () => {
  const state = usePreference(format);

  return (
    <Fieldset legend="Format">
      <ChoiceGroup
        label="Format"
        rows
        value={state().value}
        options={formatOptions}
        onPick={(next) => {
          format.set(next);
        }}
      />
    </Fieldset>
  );
};

const PenjelasanChoice = () => {
  const state = usePreference(penjelasan);
  const cukupJelasState = usePreference(cukupJelas);

  return (
    <Fieldset legend="Penjelasan">
      <ChoiceGroup
        label="Penjelasan"
        value={state().value}
        options={placementOptions}
        onPick={(next) => {
          penjelasan.set(next);
        }}
      />
      <LabelledCheckbox
        label="Tampilkan “Cukup jelas”"
        checked={cukupJelasState().value === "show"}
        disabled={state().value === "sembunyi"}
        onChange={(next) => {
          cukupJelas.set(showOrHide(next));
        }}
      />
    </Fieldset>
  );
};

const PartChoice = (props: { present: readonly (keyof typeof parts)[] }) => {
  const states = {
    pembukaan: usePreference(parts.pembukaan),
    batang: usePreference(parts.batang),
    penutup: usePreference(parts.penutup),
  };

  return (
    <Fieldset legend="Bagian yang ditampilkan">
      <For each={props.present}>
        {(name) => (
          <LabelledCheckbox
            label={partLabels[name]}
            checked={states[name]().value === "show"}
            onChange={(next) => {
              parts[name].set(showOrHide(next));
            }}
          />
        )}
      </For>
    </Fieldset>
  );
};

const FontChoice = () => {
  const current = usePreference(format);
  const asli = usePreference(fontAsli);
  const modern = usePreference(fontModern);
  const isAsli = () => current().value === "asli";

  return (
    <Fieldset
      legend={<>Huruf teks peraturan · format {isAsli() ? "Asli" : "Modern"}</>}
    >
      <ChoiceGroup
        label="Huruf teks peraturan"
        rows
        value={isAsli() ? asli().value : modern().value}
        options={fontOptions}
        onPick={(next) => {
          (isAsli() ? fontAsli : fontModern).set(next);
        }}
      />
    </Fieldset>
  );
};

const SizeChoice = () => {
  const state = usePreference(sizePreference);

  return (
    <Fieldset legend="Ukuran">
      <ChoiceGroup
        label="Ukuran"
        value={state().value}
        options={sizeOptions}
        onPick={(next) => {
          sizePreference.set(next);
        }}
      />
    </Fieldset>
  );
};

const partsPresent = (text: ReaderText) => [
  ...(text.preface.length + text.preamble.length > 0
    ? (["pembukaan"] as const)
    : []),
  "batang" as const,
  ...(text.conclusions.length > 0 ? (["penutup"] as const) : []),
];

/** The "Aa" popover: how law text is shown (DESIGN.md "Tampilan"). Offers the parts `text` has. */
export const ReadingSettings = (props: { text: ReaderText }) => (
  <Preferences preferences={readingPreferences}>
    <Popover>
      <PopoverTrigger class={css(styles.trigger)} aria-label="Tampilan teks">
        <span aria-hidden="true">Aa</span>
      </PopoverTrigger>
      <PopoverContent
        class={css(styles.pop)}
        align="end"
        sideOffset={8}
        collisionPadding={16}
      >
        <PopoverTitle class={css(accessibility.visuallyHidden)}>
          Tampilan teks
        </PopoverTitle>
        <FormatChoice />
        <Show when={props.text.penjelasan.length > 0}>
          <PenjelasanChoice />
        </Show>
        <PartChoice present={partsPresent(props.text)} />
        <FontChoice />
        <SizeChoice />
        <p class={css(reading.law, styles.preview)}>
          Setiap Orang berhak atas pengakuan, jaminan, perlindungan, dan
          kepastian hukum yang adil.
        </p>
      </PopoverContent>
    </Popover>
  </Preferences>
);
