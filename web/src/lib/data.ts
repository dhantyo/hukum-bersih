// Build-time access to the data/ folder (the source of truth).
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { parseAkn, type LawDoc } from "./lawdoc.ts";

export const DATA_DIR = resolve(process.env.DATA_DIR ?? join(process.cwd(), "..", "data"));
/** Akoma Ntoso XML generated from data/ by `hukum-bersih build-akn --out web/generated/akn`. */
export const AKN_DIR = resolve(process.env.AKN_DIR ?? join(process.cwd(), "generated", "akn"));

export type Provenance = "official" | "archive" | "media" | "leak" | null;

export interface RuuDocument {
  id: string;
  type: string;
  label?: string;
  date: string;
  provenance: Provenance;
  obtained_by?: string;
  source_url: string | null;
  sha256?: string;
  archive_url?: string;
  text?: string | null;
  note?: string;
  ruu_title?: string;
}

export interface Stage { stage: string; date: string; note?: string }

export interface Ruu {
  slug: string;
  id: string;
  title: string;
  short_name?: string;
  former_titles?: string[];
  initiator?: string;
  dpr_page?: string;
  stages: Stage[];
  documents: RuuDocument[];
  enacted_as: string | null;
}

export function loadRuus(): Ruu[] {
  const dir = join(DATA_DIR, "ruu");
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, "ruu.yaml")))
    .map((d) => {
      const rec = parseYaml(readFileSync(join(dir, d.name, "ruu.yaml"), "utf8")) as Ruu;
      // YAML turns 2026-11-19 into a Date and 2008 into a number: keep dates as written.
      const asText = (v: unknown) =>
        v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? "" : String(v);
      return {
        ...rec,
        slug: d.name,
        stages: (rec.stages ?? []).map((s) => ({ ...s, date: asText(s.date) })),
        documents: (rec.documents ?? []).map((doc) => ({ ...doc, date: asText(doc.date) })),
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title, "id"));
}

/** Documents that have a text, oldest first. */
export function versions(ruu: Ruu): RuuDocument[] {
  return ruu.documents.filter((d) => d.text).sort((a, b) => a.date.localeCompare(b.date));
}

export function loadText(ruu: Ruu, doc: RuuDocument): LawDoc {
  const file = join(AKN_DIR, "ruu", ruu.slug, `${doc.id}.xml`);
  if (!existsSync(file)) {
    throw new Error(`${file} is missing: run \`hukum-bersih build-akn --out web/generated/akn\``);
  }
  return parseAkn(readFileSync(file, "utf8"));
}
