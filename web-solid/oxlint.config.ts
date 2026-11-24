import solidV2 from "eslint-plugin-solid/configs/v2";
import { defineConfig } from "oxlint";
import antiSlop from "ultracite/oxlint/anti-slop";
import core from "ultracite/oxlint/core";
import landmines from "ultracite/oxlint/landmines";
import solid from "ultracite/oxlint/solid";
import tanstack from "ultracite/oxlint/tanstack";
import vitest from "ultracite/oxlint/vitest";

export default defineConfig({
  env: core.env,
  extends: [core, solid, tanstack, vitest, landmines, antiSlop],
  ignorePatterns: ["**/*.gen.*", "dist"],
  jsPlugins: [
    "eslint-plugin-solid",
    { name: "stylex", specifier: "@stylexjs/eslint-plugin" },
  ],
  options: { typeAware: true },
  settings: solidV2.settings,
  rules: {
    ...solidV2.rules,
    "stylex/enforce-extension": "error",
    "stylex/valid-styles": "error",
    "stylex/valid-shorthands": "error",
    "stylex/no-unused": "error",
    "stylex/sort-keys": "error",
  },
});
