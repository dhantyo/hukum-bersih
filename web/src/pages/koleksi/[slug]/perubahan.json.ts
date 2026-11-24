// Every changed pasal of a law family, per version, for the in-place comparison
// (components/CompareMode.astro): fetched by the browser only when a comparison is opened.
// Shape: lib/amendments.ts CompareData (versions; per pasal, the versions where it changed).
import { compareData, hasAmendmentSteps, versionHistory } from "../../../lib/amendments.ts";
import { loadKoleksi, type Koleksi } from "../../../lib/koleksi.ts";
import { loadRegulationText } from "../../../lib/peraturan.ts";

export function getStaticPaths() {
  return loadKoleksi().filter((k) => hasAmendmentSteps(k.base) && loadRegulationText(k.base))
    .map((k) => ({ params: { slug: k.slug }, props: { k } }));
}

export function GET({ props }: { props: { k: Koleksi } }) {
  const data = compareData(versionHistory(props.k.base, loadRegulationText(props.k.base)));
  return new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
}
