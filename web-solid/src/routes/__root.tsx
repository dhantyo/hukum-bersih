import { createRootRoute, HeadContent, Link, Outlet } from '@tanstack/solid-router';

export const Route = createRootRoute({
  head: () => ({ meta: [{ title: 'Hukum Bersih' }] }),
  component: () => <>
    <HeadContent />
    <nav class="site-nav" aria-label="Navigasi utama">
      <Link to="/">Hukum Bersih</Link>
      <Link to="/uu/">Undang-Undang</Link>
      <Link to="/cari/">Cari</Link>
    </nav>
    <Outlet />
  </>,
  notFoundComponent: () => <main>
    <h1>Halaman tidak ditemukan</h1>
    <Link to="/cari/">Cari teks hukum</Link>
  </main>,
});
