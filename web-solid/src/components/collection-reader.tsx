import { tanggal } from "../../../web/src/lib/labels.ts";
import type {
  Collection,
  CollectionComparisonView,
} from "../lib/collections.ts";
import { isPresent } from "../lib/text.ts";
import { readerClass } from "../styles/reading.ts";
import { CollectionCompare } from "./collection-compare.tsx";
import { CollectionFacts } from "./collection-facts.tsx";
import { CollectionHistory } from "./collection-timeline.tsx";
import { CollectionVersions } from "./collection-versions.tsx";
import { LawText } from "./law-text.tsx";
import { MergedBanner } from "./merged-banner.tsx";
import { ReadingSettings } from "./reading-settings.tsx";

const Breadcrumbs = (props: {
  collection: Collection;
  dated: boolean;
  date?: string | null;
}) => (
  <nav aria-label="Lokasi">
    <a href="/koleksi/">Koleksi</a>
    <span aria-hidden="true"> › </span>
    {props.dated ? (
      <>
        <a href={props.collection.path.replace(/[^/]+\/$/u, "")}>
          {props.collection.name}
        </a>
        <span aria-hidden="true"> › </span>
        <span>
          {isPresent(props.date)
            ? tanggal(props.date)
            : "tanggal tidak diketahui"}
        </span>
      </>
    ) : (
      <span>{props.collection.name}</span>
    )}
  </nav>
);

const MergedCollection = (props: {
  collection: Collection;
  version: NonNullable<Collection["merged"]>;
  comparison: CollectionComparisonView | null;
}) => (
  <>
    <p>{props.version.baseTitle}, versi gabungan</p>
    <h1>{props.version.title}</h1>
    {props.collection.named && <p>{props.collection.title}</p>}
    <p>
      {props.version.status !== null && (
        <>
          <span>{props.version.status.label}</span>{" "}
        </>
      )}
      <span>
        Versi{" "}
        {isPresent(props.version.date) ? tanggal(props.version.date) : "?"} ·
        setelah{" "}
        {props.version.amendments.map((entry) => entry.label).join(" dan ")}
      </span>
      {props.version.amended > 0 && (
        <span> diubah {props.version.amended}×</span>
      )}
    </p>
    <CollectionVersions
      versions={props.version.versions}
      current={props.collection.path}
      comparable={props.comparison !== null}
    />
    <CollectionFacts facts={props.version.facts} />
    <MergedBanner version={props.version} />
    {props.comparison !== null && (
      <CollectionCompare comparison={props.comparison} />
    )}
    <div class={readerClass}>
      <ReadingSettings text={props.version.text} />
      <LawText text={props.version.text} notes={props.version.notes} />
    </div>
  </>
);

export const CollectionReader = (props: {
  collection: Collection;
  comparison: CollectionComparisonView | null;
  dated: boolean;
}) => (
  <main>
    <Breadcrumbs
      collection={props.collection}
      dated={props.dated}
      date={props.collection.merged?.date}
    />
    {props.collection.merged === null ? (
      props.collection.timeline !== null && (
        <CollectionHistory
          name={props.collection.name}
          subtitle={props.collection.named ? props.collection.title : undefined}
          timeline={props.collection.timeline}
          comparison={props.comparison}
        />
      )
    ) : (
      <MergedCollection
        collection={props.collection}
        version={props.collection.merged}
        comparison={props.comparison}
      />
    )}
  </main>
);
