import { DOC_TYPE, tanggal } from "../../../web/src/lib/labels.ts";
import type { DraftDocument } from "../server/records/draft.ts";
import type { LawRecord } from "../server/records/law.ts";
import { isPresent } from "./text.ts";

/** The heading a law page shows: its subject, or the full title when it has none. */
export const lawHeading = (law: Pick<LawRecord, "subject" | "title">) =>
  isPresent(law.subject) ? law.subject : law.title;

/** "Draf RUU · Mei 2023": the heading of a draft document page. */
export const draftDocumentTitle = (
  document: Pick<DraftDocument, "type" | "date">
) => `${DOC_TYPE[document.type] ?? document.type} · ${tanggal(document.date)}`;
