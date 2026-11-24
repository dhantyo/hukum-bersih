import { createLocalStorage, createPreference } from "@ui-sdk/core";

const choice = <const Values extends readonly [string, ...string[]]>(
  key: string,
  attribute: `data-${string}`,
  values: Values,
  defaultValue: Values[number]
) =>
  createPreference({
    values,
    defaultValue,
    attribute,
    global: true,
    storage: createLocalStorage(key),
  });

const formats = ["modern", "asli"] as const;
const placements = ["akhir", "pasal", "sembunyi"] as const;
const sizes = ["normal", "large"] as const;
const fonts = ["serif", "literata", "sans", "atkinson"] as const;
const shown = ["show", "hide"] as const;

export const format = choice("hb-format", "data-format", formats, "modern");

export const penjelasan = choice(
  "hb-penjelasan",
  "data-penjelasan",
  placements,
  "akhir"
);

export const cukupJelas = choice("hb-cj", "data-cj", shown, "show");
export const size = choice("hb-size", "data-size", sizes, "normal");

export const fontAsli = choice(
  "hb-font-asli",
  "data-font-asli",
  fonts,
  "serif"
);

export const fontModern = choice(
  "hb-font-modern",
  "data-font-modern",
  fonts,
  "atkinson"
);

export const parts = {
  pembukaan: choice("hb-part-pembukaan", "data-pembukaan", shown, "show"),
  batang: choice("hb-part-batang", "data-batang", shown, "show"),
  penutup: choice("hb-part-penutup", "data-penutup", shown, "show"),
} as const;

export const readingPreferences = [
  format,
  penjelasan,
  cukupJelas,
  size,
  fontAsli,
  fontModern,
  ...Object.values(parts),
];
