import { httpStatus } from "@solidjs/web";

import { usePageTitle } from "../lib/head.ts";
import { Router } from "../router.tsx";

const NotFound = () => {
  httpStatus(404);
  usePageTitle(() => "Halaman tidak ditemukan");

  return (
    <main>
      <h1>Halaman tidak ditemukan</h1>
      <p>
        Halaman yang Anda cari tidak ada.{" "}
        <a href={Router.paths()}>Kembali ke beranda</a>.
      </p>
    </main>
  );
};

export default NotFound;
