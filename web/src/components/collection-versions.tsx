import type { CollectionVersion } from "../server/records/collection-version.ts";
import { VersionList } from "./version-list.tsx";

/** The "Versi" list of a collection page's side panel. */
export const CollectionVersions = (props: {
  versions: CollectionVersion["versions"];
  current: string;
  compareHref?: string;
}) => (
  <VersionList
    items={props.versions.map((version) => ({
      ...version,
      here: version.href === props.current,
    }))}
    compareHref={props.compareHref}
  />
);
