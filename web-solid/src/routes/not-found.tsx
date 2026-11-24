import { httpStatus } from "@solidjs/web";

import { slashed } from "../lib/paths.ts";
import { Router } from "../router.tsx";

const NotFound = () => {
  httpStatus(404);

  return (
    <main>
      <h1>Halaman tidak ditemukan</h1>
      <a href={slashed(Router.paths.cari)}>Cari teks hukum</a>
    </main>
  );
};

export default NotFound;
