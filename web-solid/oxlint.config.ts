import solidV2 from "eslint-plugin-solid/configs/v2";
import { defineConfig } from "oxlint";
import antiSlop from "ultracite/oxlint/anti-slop";
import core from "ultracite/oxlint/core";
import landmines from "ultracite/oxlint/landmines";
import solid from "ultracite/oxlint/solid";
import vitest from "ultracite/oxlint/vitest";

export default defineConfig({
  env: core.env,
  extends: [core, solid, vitest, landmines, antiSlop],
  ignorePatterns: ["dist"],
  jsPlugins: [
    "eslint-plugin-solid",
    "@stylexjs/eslint-plugin",
  ],
  options: { typeAware: true },
  settings: solidV2.settings,
  rules: {
    ...solidV2.rules,
    "@stylexjs/enforce-extension": "error",
    "@stylexjs/valid-styles": "error",
    "@stylexjs/valid-shorthands": "error",
    "@stylexjs/no-unused": "error",
    "@stylexjs/sort-keys": "error",
  },
});
