// Collections ("koleksi"): a law, the laws that amend it and the laws it replaced, under the
// name people use for them ("UU ITE"). Named ones come from data/koleksi/*.yaml; every other
// amended law gets an unnamed collection titled after its subject. Members are derived from
// the relationships in the law records (pipeline: hukum-bersih relations).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { DATA_DIR } from "./data.ts";
import { amendmentCount, byId, citeId, loadRegulations, rel, type Regulation } from "./peraturan.ts";

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

// ---- The collection's timeline (components/KoleksiTimeline.astro) -------------------------

export type TimelineEvent =
  | { kind: "pendahulu"; law: Regulation; date: string | null }
  | { kind: "pokok"; law: Regulation; date: string | null }
  | { kind: "perubahan"; law: Regulation; date: string | null; order: number }
  | { kind: "dicabut"; law: Regulation; date: string | null }
  | { kind: "ditetapkan-dari"; law: Regulation | { id: string }; date: string | null }  // a Perppu made law
  /** A version we know exists (named in a title, a status or an ordinal) but do not have. */
  | { kind: "tidak-tersedia"; what: string; id?: string; date: null; why: string };

const ORD = ["", "pertama", "kedua", "ketiga", "keempat", "kelima", "keenam", "ketujuh", "kedelapan", "kesembilan", "kesepuluh"];
export const ordinal = (n: number) => ORD[n] ?? `ke-${n}`;

const citeOf = (id: string) => citeId(id);
/** Why a law named in the relations is not here. */
function notImported(id: string): string {
  if (id.startsWith("perppu_")) return "Perppu belum kami impor; baru undang-undang yang tersedia.";
  if (id.startsWith("uu-drt_")) return "Undang-undang darurat belum kami impor.";
  return "Disebut dalam data sumber, tetapi belum ada di koleksi kami.";
}

/** Everything that happened to the collection, oldest first, with what we lack marked. */
export function timeline(k: Koleksi): TimelineEvent[] {
  const out: TimelineEvent[] = [];
  const isLaw = (x: Regulation | { id: string }): x is Regulation => "subject" in x;
  for (const m of members(k).filter((m) => m.role === "pendahulu")) {
    out.push(isLaw(m.law) ? { kind: "pendahulu", law: m.law, date: m.law.tanggal_penetapan }
      : { kind: "tidak-tersedia", what: "Undang-undang yang digantikan", id: m.law.id, date: null, why: notImported(m.law.id) });
  }
  for (const id of rel(k.base).enacts) {
    const law = byId(id);
    out.push(law ? { kind: "ditetapkan-dari", law, date: law.tanggal_penetapan }
      : { kind: "tidak-tersedia", what: "Perppu yang ditetapkan menjadi undang-undang ini", id, date: null, why: notImported(id) });
  }
  out.push({ kind: "pokok", law: k.base, date: k.base.tanggal_penetapan });
  let seen = 0;
  for (const m of members(k).filter((m) => m.role === "perubahan")) {
    const order = m.order ?? seen + 1;
    for (let n = seen + 1; n < order; n++) {
      out.push({ kind: "tidak-tersedia", what: `Perubahan ${ordinal(n)}`, date: null,
        why: `Judul ${citeOf(m.law.id)} menyebut dirinya perubahan ${ordinal(order)}, jadi ada perubahan sebelumnya yang belum tercatat di sini. Biasanya melalui undang-undang yang mengubah banyak undang-undang sekaligus, seperti UU Cipta Kerja.` });
    }
    seen = Math.max(seen + 1, order);
    out.push(isLaw(m.law) ? { kind: "perubahan", law: m.law, date: m.law.tanggal_penetapan, order }
      : { kind: "tidak-tersedia", what: `Perubahan ${ordinal(order)}`, id: m.law.id, date: null, why: notImported(m.law.id) });
  }
  for (const id of rel(k.base).revoked_by) {
    const law = byId(id);
    out.push(law ? { kind: "dicabut", law, date: law.tanggal_penetapan } : { kind: "tidak-tersedia", what: "Undang-undang yang mencabut", id, date: null, why: notImported(id) });
  }
  return out;
}

/** A law's place in its collection, for the box on its own page. */
export function roleIn(k: Koleksi, id: string): { label: string; order?: number } {
  if (k.base.id === id) return { label: "Undang-undang pokok" };
  const m = members(k).find((x) => x.law.id === id);
  if (m?.role === "perubahan") return { label: `Perubahan ${ordinal(m.order ?? 1)}`, order: m.order };
  if (m?.role === "pendahulu") return { label: "Digantikan" };
  return { label: "Terkait" };
}
