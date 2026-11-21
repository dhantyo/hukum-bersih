// How an amended law's pasal changed, amendment by amendment. Each amending law's instructions
// ("Pasal 4 diubah sehingga berbunyi ...") are split by `hukum-bersih build-akn` into
// generated/akn/amendments/<id>.json (pipeline/src/hukum_bersih/amendments.py). Here they are
// applied in order to the base law's original text, so each change can be shown as
// "before -> after", where "before" is the original or the wording of an earlier amendment.
// No consolidated text is published: only the pasal an amendment touched are shown.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AKN_DIR } from "./data.ts";
import { diffLines, only, type PasalComparison } from "./compare.ts";
import type { LawDoc, Pasal } from "./lawdoc.ts";
import { byId, history, rel, type Regulation } from "./peraturan.ts";

interface NewPasalJson {
  num: string;
  kind: "diubah" | "disisipkan" | "dihapus";
  text: string;
  lines: { num: string | null; text: string; indent: number }[];
}
interface InstructionJson { n: number; header: string; pasal: NewPasalJson[] }
interface AmendmentJson { id: string; amends: string; instructions: InstructionJson[] }

export interface PasalChange {
  num: string;
  kind: "diubah" | "disisipkan" | "dihapus";
  anchor: string;                 // "uu_3_2020-pasal-4"
  instruction: InstructionJson;
  /** before / after; undefined when there was no text (new pasal, deleted, or unreadable) */
  row: PasalComparison;
  /** where the "before" text comes from: the base law, an earlier amendment, or unknown */
  beforeFrom?: string;
  missingAfter: boolean;          // the new wording could not be read from the PDF
  missingBefore: boolean;         // the previous wording is not available
}

export interface AmendmentStep {
  by: Regulation | { id: string };
  date: string | null;
  order?: number;
  changes: PasalChange[];
  headerOnly: InstructionJson[];  // instructions without pasal (BAB, Bagian, Penjelasan)
  /** Amendments before this one that we do not have (its title says "perubahan keempat" but
   * we know of fewer): its "before" texts may not be the wording in force just before it. */
  gap: number;
}

function load(id: string): AmendmentJson | undefined {
  const file = join(AKN_DIR, "amendments", `${id}.json`);
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : undefined;
}

const toPasal = (p: NewPasalJson, by: string): Pasal => ({
  label: `Pasal ${p.num}`, num: p.num, eId: `${by}-pasal-${p.num}`,
  lines: p.lines.map((l) => ({ num: l.num ?? undefined, text: l.text, indent: l.indent })),
});

const row = (a: Pasal | undefined, b: Pasal | undefined): PasalComparison => {
  if (a && b) {
    const lines = diffLines(a, b);
    const same = lines.every((l) => l.kind === "sama");
    return { status: same ? "sama" : "berubah", a, b, similarity: 1, renumbered: false, moved: false, lines };
  }
  if (b) return { status: "baru", b, similarity: 0, renumbered: false, moved: false, lines: only(b, "baru") };
  if (a) return { status: "dihapus", a, similarity: 0, renumbered: false, moved: false, lines: only(a, "dihapus") };
  return { status: "berubah", similarity: 0, renumbered: false, moved: false, lines: [] };
};

/** Every amendment of ``r`` that we could read, oldest first, with each pasal before/after. */
export function amendmentSteps(r: Regulation, doc: LawDoc | undefined): AmendmentStep[] {
  const state = new Map<string, { pasal?: Pasal; from: string }>();
  for (const p of doc?.pasal ?? []) state.set(p.num, { pasal: p, from: r.id });
  const steps: AmendmentStep[] = [];
  let seen = 0;                                  // amendments counted so far, read or not
  for (const e of history(r)) {
    if (e.kind !== "diubah" || !e.by) continue;
    const order = e.order ?? seen + 1;
    const gap = Math.max(0, order - seen - 1);
    seen = Math.max(seen + 1, order);
    const data = load(e.by.id);
    if (!data || data.amends !== r.id) continue;
    const changes: PasalChange[] = [];
    const headerOnly: InstructionJson[] = [];
    for (const ins of data.instructions) {
      if (!ins.pasal.length) { headerOnly.push(ins); continue; }
      for (const p of ins.pasal) {
        const before = state.get(p.num);
        const after = p.kind !== "dihapus" && p.text ? toPasal(p, e.by.id) : undefined;
        const missingAfter = p.kind !== "dihapus" && !p.text;
        const missingBefore = p.kind !== "disisipkan" && !before?.pasal;
        changes.push({
          num: p.num, kind: p.kind, anchor: `${e.by.id}-pasal-${p.num}`, instruction: ins,
          row: row(p.kind === "disisipkan" ? undefined : before?.pasal, after),
          beforeFrom: before?.pasal ? before.from : undefined, missingAfter, missingBefore,
        });
        state.set(p.num, { pasal: after, from: e.by.id });   // unreadable -> unknown from now on
      }
    }
    steps.push({ by: e.by, date: e.date, order, changes, headerOnly, gap });
  }
  return steps;
}

/** Whether a law has amendments we can show pasal by pasal. */
export function hasAmendmentSteps(r: Regulation): boolean {
  return rel(r).amended_by.some((id) => load(id)?.amends === r.id);
}

/** Display name for a law: its short name if it has one ("UU Minerba"), for an amending law
 * the short name of what it amends ("Perubahan Kedua UU ITE"). */
const ORDINAL = ["", "", "Kedua", "Ketiga", "Keempat", "Kelima", "Keenam", "Ketujuh", "Kedelapan", "Kesembilan", "Kesepuluh"];
export function shortName(r: Regulation): string | undefined {
  if (r.short_name) return r.short_name;
  const R = rel(r);
  if (R.amends.length === 1) {
    const target = byId(R.amends[0].id);
    if (target?.short_name) {
      const o = R.amends[0].order;
      return `Perubahan${o && o > 1 ? ` ${ORDINAL[o] ?? o}` : ""} ${target.short_name}`;
    }
  }
  return undefined;
}
