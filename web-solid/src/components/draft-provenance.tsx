import {
  docTypeLabel,
  PROVENANCE,
  provenanceKey,
  tanggal,
} from "../lib/labels.ts";
import { isPresent } from "../lib/text.ts";
import type { DraftDocument } from "../server/records/draft.ts";
import { linkClass } from "../styles/link.ts";

/** "Draf RUU (Mei 2023)": a version as the comparison names it. */
export const draftVersionName = (document: DraftDocument) =>
  `${docTypeLabel(document.type)} (${tanggal(document.date)})`;

export const DraftProvenance = (props: { document: DraftDocument }) => {
  const provenance = () => PROVENANCE[provenanceKey(props.document.provenance)];

  return (
    <>
      <p title={provenance().hint}>{provenance().label}</p>
      {isPresent(props.document.label) && <p>{props.document.label}</p>}
      {isPresent(props.document.note) && <p>{props.document.note}</p>}
      {isPresent(props.document.source_url) && (
        <p>
          <a class={linkClass} href={props.document.source_url}>
            Sumber
            {isPresent(props.document.obtained_by)
              ? ` (${props.document.obtained_by})`
              : ""}
          </a>
        </p>
      )}
      {isPresent(props.document.archive_url) && (
        <p>
          <a class={linkClass} href={props.document.archive_url}>
            PDF arsip
          </a>
        </p>
      )}
    </>
  );
};
