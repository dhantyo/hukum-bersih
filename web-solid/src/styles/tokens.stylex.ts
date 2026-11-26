import * as stylex from "@stylexjs/stylex";

const DARK = "@media screen and (prefers-color-scheme: dark)";

export const color = stylex.defineVars({
  background: { default: "#ffffff", [DARK]: "#111418" },
  backgroundSubtle: { default: "#f5f6f7", [DARK]: "#181c21" },
  surface: { default: "#ffffff", [DARK]: "#1c2127" },
  text: { default: "#1b1f24", [DARK]: "#e6e8eb" },
  textMuted: { default: "#59616b", [DARK]: "#a3abb5" },
  line: { default: "#dde1e5", [DARK]: "#2d343c" },
  lineStrong: { default: "#808993", [DARK]: "#69727d" },
  link: { default: "#1d4f91", [DARK]: "#8cb4f0" },
  linkBackground: { default: "#e8f0fa", [DARK]: "#1a2a40" },
  ok: { default: "#17683a", [DARK]: "#6fcf97" },
  warn: { default: "#8a5a00", [DARK]: "#e7b75f" },
  gone: { default: "#6b7280", [DARK]: "#9aa3ad" },
  insBackground: { default: "#e3f4e8", [DARK]: "#163a24" },
  insText: { default: "#14532d", [DARK]: "#b9ecc8" },
  delBackground: { default: "#fbe4e4", [DARK]: "#43201f" },
  delText: { default: "#7f1d1d", [DARK]: "#f6c3c0" },
  modBackground: { default: "#fbefd5", [DARK]: "#3d2f12" },
  modText: { default: "#6b4400", [DARK]: "#f3d9a4" },
  scrim: { default: "rgb(17 20 24 / 0.4)", [DARK]: "rgb(0 0 0 / 0.6)" },
});

export const shadow = stylex.defineVars({
  pop: {
    default: "0 6px 24px rgb(0 0 0 / 0.12)",
    [DARK]: "0 6px 24px rgb(0 0 0 / 0.5)",
  },
  sm: {
    default: "0 1px 2px rgb(0 0 0 / 0.08)",
    [DARK]: "0 1px 2px rgb(0 0 0 / 0.4)",
  },
});

export const space = stylex.defineVars({
  hairline: "0.125rem",
  s1: "0.25rem",
  s2: "0.5rem",
  s3: "0.75rem",
  s4: "1rem",
  s5: "1.5rem",
  s6: "2rem",
  s7: "3rem",
  s8: "4rem",
});

export const font = stylex.defineVars({
  ui: "var(--font-ui)",
  sourceSerif: "var(--font-source-serif)",
  literata: "var(--font-literata)",
  atkinson: "var(--font-atkinson)",
});

export const size = stylex.defineVars({
  xs: "0.8125rem",
  sm: "0.90625rem",
  base: "1rem",
  law: "1.09375rem",
  lawLarge: "1.25rem",
  md: "1.09375rem",
  lg: "1.25rem",
  xl: "1.625rem",
  xxl: "2rem",
  tap: "2.75rem",
  page: "72rem",
  pageWide: "100rem",
  measure: "42rem",
  hang: "2.4rem",
  hangSm: "1.9rem",
  radius: "4px",
  radiusMd: "8px",
  headerMin: "4rem",
  search: "20rem",
  drawer: "22rem",
  tab: "1rem",
});

/** The breakpoints of DESIGN.md: up to 960px the panel is a drawer, up to 640px the type steps down. */
export const media = stylex.defineConsts({
  tablet: "@media (max-width: 960px)",
  tabletScripted: "@media (max-width: 960px) and (scripting: enabled)",
  phone: "@media (max-width: 640px)",
  touch: "@media (pointer: coarse), (max-width: 640px)",
});
