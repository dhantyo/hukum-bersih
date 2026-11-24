import { useHead } from "@solidjs/web";
import * as stylex from "@stylexjs/stylex";
import { isPending, Loading, Show } from "solid-js";

import { slashed } from "./lib/paths.ts";
import { Router } from "./router.tsx";
import { css } from "./styles/css.ts";
import { color, space } from "./styles/tokens.stylex.ts";

import "./styles/base.css";

const styles = stylex.create({
  nav: {
    gap: space.s4,
    paddingBlock: space.s3,
    paddingInline: space.s4,
    borderBlockEndColor: color.line,
    borderBlockEndStyle: "solid",
    borderBlockEndWidth: 1,
    display: "flex",
  },
});

const Navigation = (props: { pending: boolean }) => (
  <>
    <nav class={css(styles.nav)} aria-label="Navigasi utama">
      <a href={Router.paths()}>Hukum Bersih</a>
      <a href={slashed(Router.paths.uu)}>Undang-Undang</a>
      <a href={slashed(Router.paths.koleksi)}>Koleksi</a>
      <a href={slashed(Router.paths.ruu)}>RUU</a>
      <a href={slashed(Router.paths.cari)}>Cari</a>
    </nav>
    <Show when={props.pending}>
      <output>Memuat…</output>
    </Show>
  </>
);

const App = () => {
  useHead({ tag: "title", props: { children: "Hukum Bersih" } });

  return (
    <Router>
      {(props) => (
        <>
          <Navigation pending={isPending(() => props.children)} />
          <Loading fallback={<main>Memuat…</main>}>{props.children}</Loading>
        </>
      )}
    </Router>
  );
};

export default App;
