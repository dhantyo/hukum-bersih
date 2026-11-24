import * as stylex from "@stylexjs/stylex";

export const color = stylex.defineVars({
  background: "var(--bg)",
  text: "var(--text)",
  link: "var(--primary)",
  line: "var(--line)",
});

export const space = stylex.defineVars({
  s1: "var(--s-1)",
  s2: "var(--s-2)",
  s3: "var(--s-3)",
  s4: "var(--s-4)",
});

export const font = stylex.defineVars({
  ui: "var(--font-ui)",
  sourceSerif: "var(--font-source-serif)",
  atkinson: "var(--font-atkinson)",
});

export const size = stylex.defineVars({
  base: "var(--fs-base)",
  law: "var(--fs-law)",
  measure: "var(--measure)",
  hang: "var(--hang)",
});
