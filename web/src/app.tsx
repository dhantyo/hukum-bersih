import { Link, Meta, Title } from "@solidjs/meta";
import * as stylex from "@stylexjs/stylex";
import { isPending, Loading } from "solid-js";

import { SiteFooter } from "./components/site-footer.tsx";
import { SiteHeader } from "./components/site-header.tsx";
import { createReaderView, ReaderViewContext } from "./lib/reader-view.ts";
import { Router } from "./router.tsx";
import { css } from "./styles/css.ts";
import { size, space } from "./styles/tokens.stylex.ts";

import "./styles/stylex.css";

const COMPARING = ":has([data-cmp-bar])";

const styles = stylex.create({
  page: {
    marginInline: "auto",
    paddingInline: space.s4,
    boxSizing: "border-box",
    paddingBlockStart: space.s5,
    maxWidth: {
      default: size.page,
      [stylex.when.ancestor(COMPARING)]: size.pageWide,
    },
  },
});

const App = () => (
  <ReaderViewContext value={createReaderView()}>
    <Title>Hukum Rapih</Title>
    <Meta name="viewport" content="width=device-width, initial-scale=1" />
    <Meta name="color-scheme" content="light dark" />
    <Link rel="icon" href="data:," />
    <Router>
      {(props) => (
        <>
          <SiteHeader pending={isPending(() => props.children)} />
          <div id="main" class={css(styles.page)}>
            <Loading fallback={<main>Memuat…</main>}>{props.children}</Loading>
          </div>
          <SiteFooter />
        </>
      )}
    </Router>
  </ReaderViewContext>
);

export default App;
