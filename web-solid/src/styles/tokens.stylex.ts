import * as stylex from "@stylexjs/stylex";

export const color = stylex.defineVars({
  background: "var(--bg)",
  text: "var(--text)",
  link: "var(--primary)",
  line: "var(--line)",
  lineStrong: "var(--line-strong)",
  backgroundSubtle: "var(--bg-subtle)",
  textMuted: "var(--text-muted)",
  ok: "var(--ok)",
  warn: "var(--warn)",
  gone: "var(--gone)",
  linkBackground: "var(--primary-bg)",
});

export const space = stylex.defineVars({
  s1: "var(--s-1)",
  s2: "var(--s-2)",
  s3: "var(--s-3)",
  s4: "var(--s-4)",
  s5: "var(--s-5)",
  s6: "var(--s-6)",
  s7: "var(--s-7)",
  s8: "var(--s-8)",
});

export const font = stylex.defineVars({
  ui: "var(--font-ui)",
  sourceSerif: "var(--font-source-serif)",
  atkinson: "var(--font-atkinson)",
});

export const size = stylex.defineVars({
  xs: "var(--fs-xs)",
  sm: "var(--fs-sm)",
  base: "var(--fs-base)",
  lg: "var(--fs-lg)",
  xl: "var(--fs-xl)",
  xxl: "var(--fs-2xl)",
  page: "var(--page)",
  radius: "var(--r-sm)",
  law: "var(--fs-law)",
  measure: "var(--measure)",
  hang: "var(--hang)",
});

export const synopsis = stylex.defineVars({
  muted: "var(--text-muted)",
  ok: "var(--ok)",
  warn: "var(--warn)",
  insBackground: "var(--ins-bg)",
  insText: "var(--ins-text)",
  delBackground: "var(--del-bg)",
  delText: "var(--del-text)",
  fontLaw: "var(--font-law)",
  small: "var(--fs-sm)",
  tiny: "var(--fs-xs)",
  hairline: "var(--s-0)",
  s5: "var(--s-5)",
  s6: "var(--s-6)",
  s7: "var(--s-7)",
  radius: "var(--r-sm)",
  pageWide: "var(--page-wide)",
});
