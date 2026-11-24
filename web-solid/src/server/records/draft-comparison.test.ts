import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { compare } from "../../../../web/src/lib/compare.ts";
import type { LawDoc } from "../../../../web/src/lib/lawdoc.ts";
import { draftComparisonRows } from "../../../scripts/draft-comparison.ts";
import { readDraftComparison } from "./draft-comparison.ts";

const OLDER = "ruu_x_2023-05_draft";
const NEWER = "ruu_x_2026-11_draft-final";
const PAIR = `${OLDER}...${NEWER}`;

const document = (id: string, date: string) => ({
  id,
  type: "draft",
  date,
  provenance: "official",
  source_url: null,
  hasText: true,
});

const law = (pasal: string[]) =>
  ({
    preface: [],
    preamble: [],
    body: [],
    conclusions: [],
    penjelasan: [],
    penjelasanPasal: new Map(),
    pasal: pasal.map((text, index) => ({
      label: `Pasal ${index + 1}`,
      num: String(index + 1),
      eId: `art_${index + 1}`,
      lines: [{ text, indent: 0 }],
    })),
  }) satisfies LawDoc;

const older = law([
  "Aset hasil tindak pidana dapat dirampas oleh negara melalui pengadilan",
  "Pengadilan memeriksa permohonan perampasan aset dalam waktu tiga puluh hari",
  "Ketentuan peralihan berlaku sejak tanggal diundangkan",
]);

const newer = law([
  "Aset hasil tindak pidana dapat dirampas oleh negara melalui pengadilan negeri",
  "Badan pengelola aset dibentuk oleh presiden untuk menyimpan barang rampasan",
  "Ketentuan peralihan berlaku sejak tanggal diundangkan",
]);

const corpus = { directory: "" };

const publish = async (record: Stored) => {
  const release = path.join(corpus.directory, "releases", "r1");
  await mkdir(path.join(release, "drafts/x/comparisons"), { recursive: true });
  await writeFile(
    path.join(release, "drafts/x/comparisons", `${PAIR}.json`),
    JSON.stringify(record)
  );
  await writeFile(path.join(corpus.directory, "active-release"), "r1\n");
};

type Stored = ReturnType<typeof stored>;

const stored = () => {
  const comparison = compare(older, newer);

  return {
    name: "RUU X",
    title: "RUU tentang X",
    older: document(OLDER, "2023-05"),
    newer: document(NEWER, "2026-11-19"),
    counts: comparison.counts,
    rows: draftComparisonRows(comparison),
  };
};

describe("a published draft comparison", () => {
  beforeEach(async () => {
    corpus.directory = await mkdtemp(path.join(tmpdir(), "draft-comparison-"));
    process.env.HUKUM_CORPUS_DIR = corpus.directory;
  });

  afterEach(async () => {
    await rm(corpus.directory, { recursive: true, force: true });
  });

  it("reads back with its counts and linkable rows", async () => {
    await publish(stored());

    const record = await readDraftComparison("x", PAIR);

    expect(record?.counts).toMatchObject({ sama: 1, berubah: 1 });
    expect(record?.rows.map((row) => row.anchor)).toStrictEqual([
      "b-art_1",
      "a-art_2",
      "b-art_2",
      "b-art_3",
    ]);
    expect(record?.rows.map((row) => row.status)).toStrictEqual([
      "berubah",
      "dihapus",
      "baru",
      "sama",
    ]);
  });

  it("is found only in its published order", async () => {
    await publish(stored());

    await expect(
      readDraftComparison("x", `${NEWER}...${OLDER}`)
    ).resolves.toBeNull();
    await expect(readDraftComparison("y", PAIR)).resolves.toBeNull();
  });

  it("is refused when it is not the requested pair", async () => {
    await publish({
      ...stored(),
      newer: document("ruu_x_other", "2027-01-01"),
    });

    await expect(readDraftComparison("x", PAIR)).rejects.toThrow(
      "does not match"
    );
  });
});
