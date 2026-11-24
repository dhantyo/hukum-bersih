// The versions of a law family, from the base law's `history` (pipeline/src/hukum_bersih/
// history.py, decision 0010): the text as enacted, then one merged version per amending law.
// Used by the "Versi" list in the side panel (components/Versions.astro) and the Koleksi pages.
import { citeId, lawPath, type Regulation } from "./peraturan.ts";
import { koleksiPath, ordinal, type Koleksi } from "./koleksi.ts";

export interface HistoryPoint {
  id: string;                      // uu_4_2009_2020-06-10 (docs/NAMING.md)
  kind: "asli" | "gabungan";
  date: string | null;
  date_basis?: string | null;
  text?: string;
  after?: string[];                // the amending law(s) this point adds
  order?: number;
  counts?: { diubah: number; disisipkan: number; dihapus: number };
  missing_before?: number;
  unreadable?: string[];
  not_applied?: { by: string; instruction: number | null; header: string; affects_wording: boolean }[];
  complete?: boolean;
}
export interface HistoryChange {
  pasal: string;
  type: "diubah" | "disisipkan" | "dihapus";
  by: string;
  instruction: number | null;
  point: string;
  wording: "read" | "unreadable" | "none";
}
export interface LawHistory { points: HistoryPoint[]; changes: HistoryChange[] }

export const historyOf = (r: Regulation): LawHistory | undefined =>
  (r as Regulation & { history?: LawHistory }).history;

export interface VersionRow {
  kind: "point" | "missing";
  point?: HistoryPoint;
  label: string;                   // "Teks asli", "Setelah UU 3/2020", "Perubahan kedua"
  sub?: string;                    // "perubahan pertama · 76 diubah, 52 baru, 20 dihapus"
  date: string | null;
  href?: string;
  latest: boolean;
  /** the latest point of a law in force */
  inForce: boolean;
}

/** URL of one point: the original text is the law page; the latest merged version is the
 * Koleksi page; older merged versions have a dated page under it. */
export function pointHref(k: Koleksi, p: HistoryPoint, latest: HistoryPoint): string {
  const base = import.meta.env.BASE_URL;
  if (p.kind === "asli") return `${base}${lawPath(k.base)}`;
  if (p.id === latest.id) return `${base}${koleksiPath(k)}`;
  return `${base}${koleksiPath(k)}${p.date}/`;
}

const plural = (c: HistoryPoint["counts"]) => !c ? "" : [
  c.diubah && `${c.diubah} diubah`, c.disisipkan && `${c.disisipkan} baru`, c.dihapus && `${c.dihapus} dihapus`,
].filter(Boolean).join(", ");

/** The rows of the "Versi" list, oldest first, with known but missing amendments as rows. */
export function versionRows(k: Koleksi): VersionRow[] {
  const h = historyOf(k.base);
  if (!h || h.points.length < 2) return [];
  const latest = h.points.at(-1)!;
  const inForce = !["dicabut", "tidak_berlaku"].includes(k.base.status ?? "");
  const rows: VersionRow[] = [];
  let missingSoFar = 0;
  let seen = 0;
  for (const p of h.points) {
    if (p.kind === "gabungan") {
      for (let n = 0; n < (p.missing_before ?? 0) - missingSoFar; n++) {
        rows.push({ kind: "missing", label: `Perubahan ${ordinal(seen + n + 1)}`, sub: "belum tersedia di sini",
          date: null, latest: false, inForce: false });
      }
      seen = Math.max(seen + 1 + ((p.missing_before ?? 0) - missingSoFar), p.order ?? 0);
      missingSoFar = p.missing_before ?? 0;
    }
    const isLatest = p.id === latest.id;
    rows.push({
      kind: "point", point: p, date: p.date, latest: isLatest, inForce: isLatest && inForce,
      href: pointHref(k, p, latest),
      label: p.kind === "asli" ? "Teks asli" : `Setelah ${(p.after ?? []).map(citeId).join(" dan ")}`,
      sub: p.kind === "asli" ? citeId(k.base.id)
        : [p.order ? `perubahan ${ordinal(p.order)}` : "", plural(p.counts), p.complete === false ? "belum lengkap" : ""]
          .filter(Boolean).join(" · "),
    });
  }
  return rows;
}
