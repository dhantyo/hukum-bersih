// Small index of every law and RUU for the search page's first two groups (short name, title).
// Full text is searched with Pagefind (built after the site).
import { loadRuus } from "../../lib/data.ts";
import { amendmentCount, lawPath, loadRegulations, rel, shortCite } from "../../lib/peraturan.ts";
import { shortName } from "../../lib/amendments.ts";

export function GET() {
  const base = import.meta.env.BASE_URL;
  const laws = loadRegulations().map((r) => ({
    id: r.id,
    s: shortName(r) ?? null,             // "UU Minerba", "Perubahan Kedua UU ITE"
    c: shortCite(r),                     // "UU 4/2009"
    t: r.subject,                        // "Pertambangan Mineral dan Batubara"
    n: r.number, y: r.year,
    st: r.status,
    m: rel(r).amends.map((a) => a.id),   // what it amends (to nest amendments under the base law)
    k: amendmentCount(r),
    u: `${base}${lawPath(r)}`,
  }));
  const ruu = loadRuus().map((x) => ({
    id: `ruu_${x.slug}`, s: x.short_name ?? null, c: "RUU", t: x.title, n: "", y: 0, st: "ruu", m: [], k: 0,
    u: `${base}ruu/${x.slug}/`,
  }));
  return new Response(JSON.stringify([...laws, ...ruu]), { headers: { "content-type": "application/json" } });
}
