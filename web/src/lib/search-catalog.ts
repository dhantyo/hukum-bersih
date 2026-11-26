import { loadRuus } from "./data.ts";
import { amendmentCount, lawPath, loadRegulations, rel, shortCite } from "./peraturan.ts";
import { shortName } from "./amendments.ts";
import { amendments, koleksiPath, loadKoleksi, members } from "./koleksi.ts";

export function searchCatalog(base: string) {
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
  const ORD = ["", "pertama", "kedua", "ketiga", "keempat", "kelima", "keenam", "ketujuh", "kedelapan", "kesembilan", "kesepuluh"];
  const koleksi = loadKoleksi().map((k) => ({
    slug: k.slug, name: k.name, named: k.named, t: k.title, a: k.aliases, k: amendments(k),
    u: `${base}${koleksiPath(k)}`,
    // members: [id, role label]
    mem: members(k).map((m) => [m.law.id, m.role === "perubahan" ? `perubahan ${ORD[m.order ?? 0] ?? m.order}` : m.role === "pokok" ? "pokok" : "digantikan"]),
  }));
  return { laws: [...laws, ...ruu], koleksi };
}
