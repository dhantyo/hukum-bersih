import * as stylex from "@stylexjs/stylex";
import {
  createRootRouteWithContext,
  HeadContent,
  Link,
  Outlet,
} from "@tanstack/solid-router";

import type { RouterContext } from "../router";
import { css } from "../styles/css.ts";
import { color, space } from "../styles/tokens.stylex.ts";

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

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({ meta: [{ title: "Hukum Bersih" }] }),
  component: () => (
    <>
      <HeadContent />
      <nav class={css(styles.nav)} aria-label="Navigasi utama">
        <Link to="/">Hukum Bersih</Link>
        <Link to="/uu/">Undang-Undang</Link>
        <Link to="/koleksi/">Koleksi</Link>
        <Link to="/ruu/">RUU</Link>
        <Link to="/cari/">Cari</Link>
      </nav>
      <Outlet />
    </>
  ),
  notFoundComponent: () => (
    <main>
      <h1>Halaman tidak ditemukan</h1>
      <Link to="/cari/">Cari teks hukum</Link>
    </main>
  ),
});
