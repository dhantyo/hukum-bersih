import {
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import * as v from "valibot";

import { lawPath } from "../src/lib/schemas.ts";
import { isPresent } from "../src/lib/text.ts";
import { amendments, koleksi, peraturan, versions } from "./astro-data.ts";
import { readerText } from "./reader-text.ts";

type Regulation = ReturnType<typeof peraturan.loadRegulations>[number];

const lawHref = (id: string) => {
  const target = peraturan.pathOf(id);

  return target === undefined ? undefined : `/${target}`;
};

const lawName = (id: string) => {
  const subject = peraturan.byId(id)?.subject;

  return isPresent(subject)
    ? `${peraturan.citeId(id)} tentang ${subject}`
    : peraturan.citeId(id);
};

const revokers = (law: Regulation) =>
  peraturan.rel(law).revoked_by.map((id) => ({
    label: lawName(id),
    href: lawHref(id),
    date: peraturan.byId(id)?.tanggal_penetapan ?? null,
  }));

const changeCount = (
  changes:
    | { diubah?: string[]; disisipkan?: string[]; dihapus?: string[] }
    | undefined
) =>
  (changes?.diubah?.length ?? 0) +
  (changes?.disisipkan?.length ?? 0) +
  (changes?.dihapus?.length ?? 0);

const relations = (law: Regulation) => {
  const related = peraturan.rel(law);

  return [
    ...related.amends.map(({ id, changes }) => ({
      verb: "mengubah",
      id,
      count: changeCount(changes),
      history: true,
    })),
    ...related.revokes.map((id) => ({
      verb: "mencabut",
      id,
      count: 0,
      history: false,
    })),
    ...related.enacts.map((id) => ({
      verb: "menetapkan menjadi undang-undang",
      id,
      count: 0,
      history: false,
    })),
  ].map(({ id, ...rest }) => ({
    ...rest,
    label: lawName(id),
    href: lawHref(id),
  }));
};

const pasalNotes = (
  law: Regulation,
  comparable: boolean,
  anchors: Set<string>
) =>
  Object.fromEntries(
    [...peraturan.pasalNotes(law)].map(([num, ids]) => [
      num,
      ids.map((id) => ({
        label: peraturan.citeId(id),
        href: lawHref(id),
        by: comparable && anchors.has(`${id}-pasal-${num}`) ? id : undefined,
      })),
    ])
  );

const familyOf = (
  law: Regulation,
  collection: NonNullable<ReturnType<typeof koleksi.koleksiOf>>,
  hasText: boolean
) => {
  const isBase = collection.base.id === law.id;
  const rows = versions.versionRows(collection);

  const current = isBase ? versions.historyOf(law)?.points[0]?.id : undefined;

  const latest = rows.at(-1);

  return {
    slug: collection.slug,
    name: collection.name,
    named: collection.named,
    isBase,
    role: koleksi.roleIn(collection, law.id).label,
    versions: rows.map((row) => ({
      kind: row.kind,
      label: row.label,
      sub: row.sub,
      date: row.date,
      href: row.href,
      inForce: row.inForce,
      here: row.point !== undefined && row.point.id === current,
      made:
        row.point !== undefined &&
        !isBase &&
        row.point.after?.includes(law.id) === true,
    })),
    latestHref:
      isBase && rows.length > 0 && isPresent(latest?.href)
        ? latest.href
        : undefined,
    comparable: hasText && isBase && amendments.hasAmendmentSteps(law),
    steps: koleksi
      .timeline(collection)
      .filter((event) => event.kind !== "dicabut")
      .map((event) =>
        event.kind === "tidak-tersedia"
          ? {
              kind: "missing" as const,
              label: isPresent(event.id)
                ? peraturan.citeId(event.id)
                : event.what.replace(/^Perubahan /u, "perubahan "),
              title: `${event.what}: belum tersedia`,
            }
          : {
              kind: event.kind,
              label: peraturan.citeId(event.law.id),
              here: event.law.id === law.id,
              href: "subject" in event.law ? lawHref(event.law.id) : undefined,
              order:
                event.kind === "perubahan"
                  ? koleksi.ordinal(event.order)
                  : undefined,
            }
      ),
  };
};

const family = (law: Regulation, hasText: boolean) => {
  const collection = koleksi.koleksiOf(law.id);

  return collection && familyOf(law, collection, hasText);
};

const perubahanTarget = (law: Regulation, hasText: boolean) => {
  const collection = koleksi.koleksiOf(law.id);
  const last = collection ? versions.versionRows(collection).at(-1) : undefined;
  const own = `/${peraturan.lawPath(law)}`;

  if (isPresent(last?.href) && last.point?.kind === "gabungan") {
    return last.href;
  }

  if (collection?.base.id === law.id && hasText) {
    return own;
  }

  return collection ? `/${koleksi.koleksiPath(collection)}` : own;
};

const missingText = (law: Regulation) => {
  if (isPresent(law.pdf_quality)) {
    return "ocr";
  }

  return isPresent(law.parse_error) ? "unparsed" : "pending";
};

const readerLaw = (law: Regulation) => {
  const document = peraturan.loadRegulationText(law);

  if (!document && law.versions.some((version) => isPresent(version.text))) {
    throw new Error(`Generated Akoma Ntoso is missing for ${law.id}`);
  }

  const hasText = document !== undefined;
  const info = family(law, hasText);

  const comparedAnchors = new Set(
    amendments
      .amendmentSteps(law, document)
      .flatMap((step) => step.changes.map((change) => change.anchor))
  );

  return {
    path: `/${peraturan.lawPath(law)}`,
    title: law.title,
    subject: law.subject,
    shortName: amendments.shortName(law),
    cite: peraturan.shortCite(law),
    year: law.year,
    status: law.status,
    statusLabel: peraturan.STATUS_LABEL[law.status ?? ""] ?? law.status,
    date: law.tanggal_penetapan,
    place: law.tempat_penetapan,
    official: law.pejabat_penetapan,
    initiator: law.pemrakarsa,
    pasalCount: law.versions.find((version) => (version.pasal_count ?? 0) > 0)
      ?.pasal_count,
    amendmentCount: peraturan.amendmentCount(law),
    source: law.source_url,
    sourceName: peraturan.sourceName(law.source_url),
    pdf: law.source_pdf_url,
    archive: law.archive_url,
    text: document ? readerText(document) : null,
    missingText: document ? undefined : missingText(law),
    revokedBy: revokers(law),
    relations: relations(law),
    notes: pasalNotes(law, info?.comparable === true, comparedAnchors),
    family: info,
    perubahanTarget: perubahanTarget(law, hasText),
  };
};

export const exportLaws = (stage: string) => {
  const laws = peraturan.loadRegulations().filter((law) => law.type === "uu");

  if (laws.length === 0) {
    throw new Error("The corpus contains no laws");
  }

  mkdirSync(stage, { recursive: true });
  const scratch = mkdtempSync(path.join(stage, ".laws-"));

  try {
    for (const law of laws) {
      const lawDirectory = peraturan.lawPath(law);

      if (!v.is(lawPath, `/${lawDirectory}`)) {
        throw new Error(`Invalid law path: ${lawDirectory}`);
      }

      const file = path.join(scratch, lawDirectory, "index.json");
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, `${JSON.stringify(readerLaw(law))}\n`, {
        flag: "wx",
      });
    }

    renameSync(scratch, path.join(stage, "laws"));
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }

  console.log(`Exported ${laws.length} laws`);
};
