import { useHead } from "@solidjs/web";
import * as stylex from "@stylexjs/stylex";
import { isPending, Loading } from "solid-js";

import { SiteFooter } from "./components/site-footer.tsx";
import { SiteHeader } from "./components/site-header.tsx";
import { Router } from "./router.tsx";
import { css } from "./styles/css.ts";
import { size, space } from "./styles/tokens.stylex.ts";

import "./styles/stylex.css";

const styles = stylex.create({
  page: {
    marginInline: "auto",
    paddingInline: space.s4,
    boxSizing: "border-box",
    paddingBlockStart: space.s5,
    maxWidth: size.page,
  },
});

const App = () => {
  useHead({ tag: "title", props: { children: "Hukum Bersih" } });

  return (
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
  );
};

export default App;
