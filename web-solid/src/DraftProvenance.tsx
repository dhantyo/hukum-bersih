import {
  DOC_TYPE,
  PROVENANCE,
  provenanceKey,
  tanggal,
} from "../../web/src/lib/labels.ts";
import type { DraftDocument } from "./server/draft-record";

export function draftDocumentTitle(document: DraftDocument) {
  return `${DOC_TYPE[document.type] ?? document.type} · ${tanggal(document.date)}`;
}

export function DraftProvenance(props: { document: DraftDocument }) {
  const provenance = () => PROVENANCE[provenanceKey(props.document.provenance)];

  return (
    <>
      <p title={provenance().hint}>{provenance().label}</p>
      {props.document.label && <p>{props.document.label}</p>}
      {props.document.note && <p>{props.document.note}</p>}
      {props.document.source_url && (
        <p>
          <a href={props.document.source_url}>
            Sumber
            {props.document.obtained_by
              ? ` (${props.document.obtained_by})`
              : ""}
          </a>
        </p>
      )}
      {props.document.archive_url && (
        <p>
          <a href={props.document.archive_url}>PDF arsip</a>
        </p>
      )}
    </>
  );
}
