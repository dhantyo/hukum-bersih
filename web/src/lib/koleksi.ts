// Collections ("koleksi"): a law, the laws that amend it and the laws it replaced, under the
// name people use for them ("UU ITE"). Named ones come from data/koleksi/*.yaml; every other
// amended law gets an unnamed collection titled after its subject. Members are derived from
// the relationships in the law records (pipeline: hukum-bersih relations).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { DATA_DIR } from "./data.ts";
import { amendmentCount, byId, loadRegulations, rel, type Regulation } from "./peraturan.ts";

export interface Koleksi {
  slug: string;
  name: string;               // "UU ITE"; for unnamed ones the subject
  named: boolean;             // has a common short name (a file in data/koleksi)
  title: string;              // "Informasi dan Transaksi Elektronik"
  base: Regulation;
  aliases: string[];
}

export type Role = "pokok" | "perubahan" | "pendahulu" | "lain";
export interface Member {
  law: Regulation | { id: string };
  role: Role;
  order?: number;              // for amendments: 1 = pertama ...
}

const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

let cache: Koleksi[] | undefined;
export function loadKoleksi(): Koleksi[] {
  if (cache) return cache;
  const out: Koleksi[] = [];
  const dir = join(DATA_DIR, "koleksi");
  const extra = new Map<string, string[]>();
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".yaml"))) {
      const d = parseYaml(readFileSync(join(dir, f), "utf8"));
      const base = byId(d.base);
      if (!base) continue;
      out.push({ slug: d.slug, name: d.name, named: true, title: d.title ?? base.subject, base, aliases: d.aliases ?? [] });
      extra.set(d.slug, d.members ?? []);
    }
  }
  const taken = new Set(out.map((k) => k.base.id));
  const slugs = new Set(out.map((k) => k.slug));
  for (const r of loadRegulations()) {
    if (taken.has(r.id) || rel(r).amended_by.length === 0 || rel(r).amends.length > 0) continue;
    let slug = slugify(r.subject || r.id) || r.id;
    if (slugs.has(slug)) slug = `${slug}-${r.year}`;
    slugs.add(slug);
    out.push({ slug, name: r.subject || r.title, named: false, title: r.subject, base: r, aliases: [] });
  }
  extraMembers = extra;
  cache = out.sort((a, b) => Number(b.named) - Number(a.named) || a.name.localeCompare(b.name, "id"));
  return cache;
}
let extraMembers = new Map<string, string[]>();

/** The laws in a collection: replaced laws first, then the base law and its amendments by date. */
export function members(k: Koleksi): Member[] {
  const R = rel(k.base);
  const date = (id: string) => byId(id)?.tanggal_penetapan ?? String(byId(id)?.year ?? "");
  const pred = [...new Set([...R.revokes, ...(extraMembers.get(k.slug) ?? [])])].sort((a, b) => date(a).localeCompare(date(b)));
  const am = R.amended_by.map((id) => {
    const by = byId(id);
    return { law: by ?? { id }, role: "perubahan" as const, order: by ? rel(by).amends.find((a) => a.id === k.base.id)?.order : undefined };
  });
  let n = 0;
  for (const m of am) m.order = m.order ?? (n + 1), n = m.order;
  return [
    ...pred.map((id) => ({ law: byId(id) ?? { id }, role: "pendahulu" as const })),
    { law: k.base, role: "pokok" as const },
    ...am,
  ];
}

let index: Map<string, Koleksi> | undefined;
/** The collection a law belongs to (as base, amendment or replaced law). */
export function koleksiOf(id: string): Koleksi | undefined {
  if (!index) {
    index = new Map();
    for (const k of loadKoleksi()) for (const m of members(k)) if (!index.has(m.law.id)) index.set(m.law.id, k);
  }
  return index.get(id);
}

export const koleksiPath = (k: Koleksi) => `koleksi/${k.slug}/`;
export const amendments = (k: Koleksi) => amendmentCount(k.base);
