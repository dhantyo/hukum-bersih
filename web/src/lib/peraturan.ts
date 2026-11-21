// Build-time access to regulations in data/peraturan/ (records written by
// pipeline/src/hukum_bersih/sources/peraturan_go_id.py) and their generated Akoma Ntoso.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { AKN_DIR, DATA_DIR } from "./data.ts";
import { parseAkn, type LawDoc } from "./lawdoc.ts";

export interface Version {
  id: string;
  kind: string;
  source: string;
  date: string | null;
  text?: string;
  pasal_count?: number;
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
  dir: string;           // data folder, relative to data/peraturan
  archive_url?: string;
}

export const JENIS: Record<string, { name: string; short: string }> = {
  uu: { name: "Undang-Undang", short: "UU" },
  perppu: { name: "Peraturan Pemerintah Pengganti Undang-Undang", short: "Perppu" },
  pp: { name: "Peraturan Pemerintah", short: "PP" },
  perpres: { name: "Peraturan Presiden", short: "Perpres" },
};

export const STATUS_LABEL: Record<string, string> = {
  berlaku: "Berlaku",
  diubah: "Diubah",
  dicabut: "Dicabut",
  tidak_berlaku: "Tidak berlaku",
};

// Words kept lowercase inside Indonesian titles (except at the start).
const SMALL = new Set(["dan", "atau", "di", "ke", "dari", "yang", "untuk", "tentang", "atas",
  "terhadap", "dengan", "pada", "dalam", "oleh", "serta", "bagi", "sebagai", "antara", "menjadi",
  "kepada", "tanpa", "melalui", "secara", "beserta", "mengenai", "of", "the"]);
// Acronyms and roman numerals stay upper case.
const KEEP_UPPER = /^(?:[IVXLC]+|RI|NRI|DPR|DPD|MPR|BPK|APBN|APBD|KUHP|KUHAP|ITE|TNI|POLRI|BUMN|BUMD|PNPS|UUD)$/;

/** "PELINDUNGAN SAKSI DAN KORBAN" -> "Pelindungan Saksi dan Korban". */
export function judul(text: string): string {
  return text.toLowerCase().split(/(\s+|-|\/|\()/).map((w, k) => {
    if (!/[a-z]/.test(w)) return w;
    const up = w.toUpperCase();
    if (KEEP_UPPER.test(up)) return up;
    if (k > 0 && SMALL.has(w)) return w;
    return w[0].toUpperCase() + w.slice(1);
  }).join("").replace(/^\s+/, "");
}

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
