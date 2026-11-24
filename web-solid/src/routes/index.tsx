import { createFileRoute, Link } from "@tanstack/solid-router";

export const Route = createFileRoute("/")({
  component: () => (
    <main>
      <h1>Hukum Indonesia, mudah dibaca.</h1>
      <Link to="/cari/">Cari teks hukum</Link>
    </main>
  ),
});
