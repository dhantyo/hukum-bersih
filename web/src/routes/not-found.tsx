import { httpStatus } from "@solidjs/web";

import { PageTitle } from "../components/page-title.tsx";
import { Router } from "../router.tsx";
import { linkClass } from "../styles/link.ts";

const NotFound = () => {
  httpStatus(404);

  return (
    <main>
      <PageTitle>Halaman tidak ditemukan</PageTitle>
      <h1>Halaman tidak ditemukan</h1>
      <p>
        Halaman yang Anda cari tidak ada.{" "}
        <a class={linkClass} href={Router.paths()}>
          Kembali ke beranda
        </a>
        .
      </p>
    </main>
  );
};

export default NotFound;
