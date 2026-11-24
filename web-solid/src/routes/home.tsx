import { slashed } from "../lib/paths.ts";
import { Router } from "../router.tsx";

const Home = () => (
  <main>
    <h1>Hukum Indonesia, mudah dibaca.</h1>
    <a href={slashed(Router.paths.cari)}>Cari teks hukum</a>
  </main>
);

export default Home;
