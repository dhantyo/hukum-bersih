// Build-time access to regulations in data/peraturan/ (records written by
// pipeline/src/hukum_bersih/sources/peraturan_go_id.py) and their generated Akoma Ntoso.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { AKN_DIR, DATA_DIR } from "./data.ts";
import { parseAkn, type LawDoc } from "./lawdoc.ts";
import { judul } from "./title.ts";

export interface Version {
  id: string;
  kind: string;
  source: string;
  date: string | null;
  text?: string;
  pasal_count?: number;
}

export interface Changes { diubah?: string[]; disisipkan?: string[]; dihapus?: string[] }

export interface Relationships {
  amends: { id: string; order?: number; changes?: Changes }[];
  amended_by: string[];
  revokes: string[];
  revoked_by: string[];
  enacts: string[];
  enacted_by: string[];
}

export interface Regulation {
  id: string;            // uu_11_2008
  type: string;          // uu
  number: string;
  year: number;
  tentang: string | null;
  title: string;         // display title, e.g. "Undang-Undang Nomor 11 Tahun 2008"
  subject: string;       // "Informasi dan Transaksi Elektronik"
  short_name: string | null;
  status: string | null;
  tanggal_penetapan: string | null;
  tempat_penetapan: string | null;
  pejabat_penetapan: string | null;
  pemrakarsa: string | null;
  source_url: string;
  source_pdf_url: string | null;
  pdf_quality?: string;
  parse_error?: string;
  versions: Version[];
  relationships?: Partial<Relationships>;
  dir: string;           // data folder, relative to data/peraturan
  archive_url?: string;
}

export const JENIS: Record<string, { name: string; short: string }> = {
  uu: { name: "Undang-Undang", short: "UU" },
  perppu: { name: "Peraturan Pemerintah Pengganti Undang-Undang", short: "Perppu" },
  pp: { name: "Peraturan Pemerintah", short: "PP" },
  perpres: { name: "Peraturan Presiden", short: "Perpres" },
};

// Official sites we take regulations from, by host: how to name them to readers.
export const SOURCES: Record<string, { name: string; owner: string }> = {
  "peraturan.bpk.go.id": { name: "JDIH BPK", owner: "Badan Pemeriksa Keuangan" },
  "peraturan.go.id": {
    name: "peraturan.go.id",
    owner: "Direktorat Jenderal Peraturan Perundang-undangan, Kementerian Hukum",
  },
};

export const sourceHost = (url: string | null | undefined) => (url ? new URL(url).hostname : null);
export const sourceName = (url: string | null | undefined) => {
  const host = sourceHost(url);
  return host ? (SOURCES[host]?.name ?? host) : null;
};

export const STATUS_LABEL: Record<string, string> = {
  berlaku: "Berlaku",
  diubah: "Diubah",
  dicabut: "Dicabut",
  tidak_berlaku: "Tidak berlaku",
};

/** Some source titles repeat the citation: "UNDANG-UNDANG REPUBLIK INDONESIA NOMOR 4 TAHUN
 * 2026 TENTANG PERUBAHAN ..." -> "PERUBAHAN ...". */
function stripCitation(text: string): string {
  return text.replace(/^\s*(?:UNDANG-UNDANG|PERATURAN\s+\S+)(?:\s+REPUBLIK\s+INDONESIA)?\s+NOMOR\s+\S+\s+TAHUN\s+\d{4}\s+TENTANG\s+/i, "");
}

let cache: Regulation[] | undefined;

/** Archive links per regulation id, from the source manifests. */
function archiveUrls(): Map<string, string> {
  const map = new Map<string, string>();
  const dir = join(DATA_DIR, "sources", "manifests");
  if (!existsSync(dir)) return map;
  for (const f of readdirSync(dir)) {
    for (const line of readFileSync(join(dir, f), "utf8").split("\n")) {
      if (!line.trim()) continue;
      const rec = JSON.parse(line);
      if (rec.archive_url && rec.doc_id) map.set(String(rec.doc_id).replace(/_\d{4}-\d{2}-\d{2}$/, ""), rec.archive_url);
    }
  }
  return map;
}

export function loadRegulations(): Regulation[] {
  if (cache) return cache;
  const root = join(DATA_DIR, "peraturan");
  const archived = archiveUrls();
  const out: Regulation[] = [];
  if (existsSync(root)) {
    for (const jenis of readdirSync(root)) {
      const jdir = join(root, jenis);
      if (!existsSync(jdir) || jenis.startsWith(".")) continue;
      for (const year of readdirSync(jdir)) {
        if (year.startsWith(".")) continue;
        for (const id of readdirSync(join(jdir, year))) {
          const file = join(jdir, year, id, `${id}.yaml`);
          if (!existsSync(file)) continue;
          const rec = parseYaml(readFileSync(file, "utf8")) as Regulation;
          const asText = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? null : String(v));
          const j = JENIS[rec.type] ?? { name: rec.type.toUpperCase(), short: rec.type.toUpperCase() };
          out.push({
            ...rec,
            number: String(rec.number),
            // peraturan.go.id: "Tidak Berlaku Dicabut Oleh : Undang-Undang Nomor 40 Tahun 2007 ..."
            status: /dicabut/i.test(rec.status ?? "") ? "dicabut" : /tidak berlaku/i.test(rec.status ?? "") ? "tidak_berlaku" : rec.status,
            tanggal_penetapan: asText(rec.tanggal_penetapan),
            versions: (rec.versions ?? []).map((v) => ({ ...v, date: asText(v.date) })),
            title: `${j.name} Nomor ${String(rec.number).toUpperCase()} Tahun ${rec.year}`,
            subject: rec.tentang ? judul(stripCitation(rec.tentang)) : "",
            pejabat_penetapan: rec.pejabat_penetapan ? judul(rec.pejabat_penetapan) : null,
            pemrakarsa: rec.pemrakarsa ? judul(rec.pemrakarsa) : null,
            dir: `${jenis}/${year}/${id}`,
            archive_url: archived.get(rec.id),
          });
        }
      }
    }
  }
  const num = (r: Regulation) => parseInt(r.number, 10) || 0;
  cache = out.sort((a, b) => b.year - a.year || num(b) - num(a));
  return cache;
}

export function loadRegulationText(r: Regulation): LawDoc | undefined {
  const v = r.versions.find((x) => x.text);
  if (!v) return undefined;
  const file = join(AKN_DIR, "peraturan", r.dir, `${v.id}.xml`);
  return existsSync(file) ? parseAkn(readFileSync(file, "utf8")) : undefined;
}

export const lawPath = (r: Regulation) => `${r.type}/${r.number}/${r.year}/`;
export const shortCite = (r: Regulation) =>
  `${(JENIS[r.type]?.short ?? r.type.toUpperCase())} ${r.number.toUpperCase()}/${r.year}`;

const EMPTY: Relationships = { amends: [], amended_by: [], revokes: [], revoked_by: [], enacts: [], enacted_by: [] };
export const rel = (r: Regulation): Relationships => ({ ...EMPTY, ...(r.relationships ?? {}) });

let index: Map<string, Regulation> | undefined;
export function byId(id: string): Regulation | undefined {
  index ??= new Map(loadRegulations().map((r) => [r.id, r]));
  return index.get(id);
}

/** "uu_11_2008" -> "UU 11/2008", "perppu_2_2022" -> "Perppu 2/2022", "uu-drt_7_1956" -> "UU Darurat 7/1956". */
export function citeId(id: string): string {
  const m = id.match(/^([a-z-]+)_([0-9a-z]+)_(\d{4})$/);
  if (!m) return id;
  const jenis = m[1] === "uu-drt" ? "UU Darurat" : (JENIS[m[1]]?.short ?? m[1].toUpperCase());
  return `${jenis} ${m[2].toUpperCase()}/${m[3]}`;
}

/** Site path for a regulation id, if we have its page. */
export function pathOf(id: string): string | undefined {
  const r = byId(id);
  return r ? lawPath(r) : undefined;
}

export interface HistoryEvent {
  date: string | null;
  kind: "diundangkan" | "diubah" | "dicabut" | "ditetapkan";
  by?: Regulation | { id: string };
  order?: number;
  changes?: Changes;
}

/** Everything that happened to a regulation, oldest first: its enactment, each law that
 * amended it (with the pasal it changed), revocation, and confirmation of a Perppu. */
export function history(r: Regulation): HistoryEvent[] {
  const R = rel(r);
  const events: HistoryEvent[] = [{ date: r.tanggal_penetapan, kind: "diundangkan" }];
  for (const id of R.amended_by) {
    const by = byId(id);
    const entry = by ? rel(by).amends.find((a) => a.id === r.id) : undefined;
    events.push({ date: by?.tanggal_penetapan ?? null, kind: "diubah", by: by ?? { id }, order: entry?.order, changes: entry?.changes });
  }
  for (const id of R.revoked_by) {
    const by = byId(id);
    events.push({ date: by?.tanggal_penetapan ?? null, kind: "dicabut", by: by ?? { id } });
  }
  for (const id of R.enacted_by) {
    const by = byId(id);
    events.push({ date: by?.tanggal_penetapan ?? null, kind: "ditetapkan", by: by ?? { id } });
  }
  return events.sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));
}

/** Per pasal number: the laws that changed it (for markers in the text). */
export function pasalNotes(r: Regulation): Map<string, string[]> {
  const notes = new Map<string, string[]>();
  for (const e of history(r)) {
    if (e.kind !== "diubah" || !e.changes) continue;
    for (const n of [...(e.changes.diubah ?? []), ...(e.changes.dihapus ?? [])]) {
      notes.set(n, [...(notes.get(n) ?? []), e.by!.id]);
    }
  }
  return notes;
}

/** How many times a law was amended: the laws we know, or more when an amending law's title
 * says so ("perubahan keempat" while we only know two). */
export function amendmentCount(r: Regulation): number {
  const orders = rel(r).amended_by.map((id) => byId(id) ? rel(byId(id)!).amends.find((a) => a.id === r.id)?.order ?? 1 : 1);
  return Math.max(rel(r).amended_by.length, ...orders, 0);
}
