import { HydrationScript } from "@solidjs/web";
import * as stylex from "@stylexjs/stylex";
import { preloads } from "fontless/runtime";
import { For } from "solid-js";
import type { ParentProps } from "solid-js";

import { css } from "./styles/css.ts";
import { color, font, size } from "./styles/tokens.stylex.ts";

const styles = stylex.create({
  body: {
    margin: 0,
    backgroundColor: color.background,
    color: color.text,
    fontFamily: font.ui,
    fontSize: size.base,
    lineHeight: 1.6,
  },
});

const Document = (props: ParentProps) => (
  <html lang="id" class={css(stylex.defaultMarker())}>
    <head>
      <meta charset="utf-8" />
      <meta property="csp-nonce" />
      <For each={preloads}>{(link) => <link {...link} />}</For>
      <HydrationScript />
    </head>
    <body class={css(styles.body)}>{props.children}</body>
  </html>
);

export default Document;
