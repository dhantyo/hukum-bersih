import { createRootRouteWithContext, HeadContent, Link, Outlet } from '@tanstack/solid-router';

import type { RouterContext } from '../router';

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({ meta: [{ title: 'Hukum Bersih' }] }),
  component: () => <>
    <HeadContent />
    <nav class="site-nav" aria-label="Navigasi utama">
      <Link to="/">Hukum Bersih</Link>
      <Link to="/uu/">Undang-Undang</Link>
      <Link to="/koleksi/">Koleksi</Link>
      <Link to="/ruu/">RUU</Link>
      <Link to="/cari/">Cari</Link>
    </nav>
    <Outlet />
  </>,
  notFoundComponent: () => <main>
    <h1>Halaman tidak ditemukan</h1>
    <Link to="/cari/">Cari teks hukum</Link>
  </main>,
});
