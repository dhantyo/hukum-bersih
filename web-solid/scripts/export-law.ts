import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const [lawId, output] = process.argv.slice(2);
if (!lawId || !output) {
  throw new Error("Use pnpm run export-law <law-id> <output.json> or pnpm run export-law --all <release-directory>.");
}
const destination = resolve(output);

// The current loaders resolve the generated corpus relative to the Astro project.
process.chdir(fileURLToPath(new URL("../../web/", import.meta.url)));
const { loadRegulations, loadRegulationText, lawPath, citeId, pathOf } = await import("../../web/src/lib/peraturan.ts");
const { amendmentSteps, shortName } = await import("../../web/src/lib/amendments.ts");
const { articleAliases } = await import("../../web/src/lib/article-anchors.ts");

const { pasalText } = await import("../../web/src/lib/lawtext.ts");

function readerText(document: NonNullable<ReturnType<typeof loadRegulationText>>) {
  return {
    preface: document.preface,
    preamble: document.preamble,
    body: document.body,
    conclusions: document.conclusions,
    penjelasan: document.penjelasan,
    anchors: Object.fromEntries(articleAliases(document.body)),
  };
}

type Regulation = ReturnType<typeof loadRegulations>[number];

function readerAmendments(regulation: Regulation, text: ReturnType<typeof loadRegulationText>) {
  return amendmentSteps(regulation, text).map(({ by, changes, headerOnly, date, gap }) => {
    const href = pathOf(by.id);
    return {
      id: by.id,
      label: citeId(by.id),
      href: href && `/${href}`,
      date,
      gap,
      instructions: headerOnly.map(({ header }) => header),
      changes: changes.map(({ anchor, num, row, kind, missingBefore, missingAfter }) => ({
        anchor, num, kind, missingBefore, missingAfter,
        before: row.a ? pasalText(row.a) : null,
        after: row.b ? pasalText(row.b) : null,
      })),
    };
  });
}

function readerLaw(law: Regulation) {
  const document = loadRegulationText(law);
  if (!document && law.versions.some((version) => version.text)) {
    throw new Error(`Generated Akoma Ntoso is missing for ${law.id}`);
  }

  return {
    path: `/${lawPath(law)}`,
    title: law.title,
    subject: law.subject,
    shortName: shortName(law),
    status: law.status,
    source: law.source_url,
    pdf: law.source_pdf_url,
    archive: law.archive_url,
    text: document ? readerText(document) : null,
    amendments: readerAmendments(law, document),
  };
}

async function writeLaw(law: Regulation, file: string, flag = "w") {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(readerLaw(law)) + "\n", { flag });
}

async function exportCorpus(laws: Regulation[], directory: string) {
  if (!laws.length) throw new Error("The corpus contains no laws");
  await mkdir(directory, { recursive: true });
  const scratch = await mkdtemp(join(directory, ".laws-"));
  try {
    for (const law of laws) {
      const path = lawPath(law);
      if (!/^uu\/\d+\/\d{4}\/$/.test(path)) throw new Error(`Invalid law path: ${path}`);
      await writeLaw(law, join(scratch, path, "index.json"), "wx");
    }
    await rename(scratch, join(directory, "laws"));
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
  console.log(`Exported ${laws.length} laws`);
}

const laws = loadRegulations().filter((law) => law.type === "uu");
if (lawId === "--all") {
  await exportCorpus(laws, destination);
} else {
  const law = laws.find((record) => record.id === lawId);
  if (!law) throw new Error(`Unknown law: ${lawId}`);
  await writeLaw(law, destination);
}
