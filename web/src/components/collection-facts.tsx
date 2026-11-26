import type { CollectionVersion } from "../server/records/collection-version.ts";
import { Facts } from "./law-panel.tsx";

/** The laws of the collection with the part each plays: base law, amendments, replaced laws. */
export const CollectionFacts = (props: {
  facts: CollectionVersion["facts"];
}) => <Facts title="Undang-undang" facts={props.facts} />;
