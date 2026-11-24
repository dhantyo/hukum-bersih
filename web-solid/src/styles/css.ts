import * as stylex from "@stylexjs/stylex";
import type { CompiledStyles, StyleXArray } from "@stylexjs/stylex";

type Style = StyleXArray<CompiledStyles | boolean | null | undefined>;

export const css = (...styles: Style[]) => stylex.props(...styles).className;
