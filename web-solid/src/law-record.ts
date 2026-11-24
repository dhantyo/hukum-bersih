import type { AknNode } from "../../web/src/lib/lawdoc.ts";

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function isOptionalString(input: unknown) {
  return input === undefined || typeof input === "string";
}

function isNode(input: unknown): input is AknNode {
  return isRecord(input) && typeof input.tag === "string" &&
    isOptionalString(input.eId) && isOptionalString(input.num) &&
    isOptionalString(input.heading) && isOptionalString(input.text) &&
    isNodes(input.children);
}

function isNodes(input: unknown): input is AknNode[] {
  return Array.isArray(input) && input.every(isNode);
}

function isAnchors(input: unknown): input is Record<string, string> {
  return isRecord(input) && Object.values(input).every((anchor) =>
    typeof anchor === "string" && /^pasal-[a-z0-9]+$/.test(anchor));
}

export type LawText = Pick<import("../../web/src/lib/lawdoc.ts").LawDoc,
  "preface" | "preamble" | "body" | "conclusions" | "penjelasan"> & { anchors: Record<string, string> };

export function isLawText(input: unknown): input is LawText {
  return isRecord(input) && isNodes(input.preface) && isNodes(input.preamble) &&
    isNodes(input.body) && isNodes(input.conclusions) && isNodes(input.penjelasan) &&
    isAnchors(input.anchors);
}

function isWebUrl(input: unknown): input is string {
  if (typeof input !== "string") return false;
  const url = URL.parse(input);
  return url?.protocol === "https:" || url?.protocol === "http:";
}

export function parseLawRecord(input: unknown, path: string) {
  if (!isRecord(input) || input.path !== path || typeof input.title !== "string" ||
      typeof input.subject !== "string" || !Array.isArray(input.amendments) || !isWebUrl(input.source) ||
      !isOptionalString(input.shortName) ||
      (input.pdf !== null && !isWebUrl(input.pdf)) ||
      (input.archive !== undefined && !isWebUrl(input.archive)) ||
      (input.text !== null && !isLawText(input.text))) {
    throw new Error(`Invalid published law at ${path}`);
  }
  return {
    title: input.title,
    hasAmendments: input.amendments.length > 0,
    subject: input.subject,
    shortName: input.shortName,
    source: input.source,
    pdf: input.pdf,
    archive: input.archive,
    text: input.text,
  };
}

export type ReaderLaw = ReturnType<typeof parseLawRecord>;
