import { HydrationScript } from "@solidjs/web";
import * as stylex from "@stylexjs/stylex";
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
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="color-scheme" content="light dark" />
      <link rel="icon" href="data:," />
      <link
        rel="stylesheet"
        href={
          import.meta.env.DEV ? "/virtual:stylex.css" : "/assets/stylex.css"
        }
      />
      <HydrationScript />
    </head>
    <body class={css(styles.body)}>{props.children}</body>
  </html>
);

export default Document;
