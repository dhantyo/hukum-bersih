import * as stylex from "@stylexjs/stylex";
import { Show } from "solid-js";

import type {
  Collection,
  CollectionComparisonView,
} from "../lib/collections.ts";
import { tanggal } from "../lib/labels.ts";
import { useSpanText } from "../lib/span-text.ts";
import { isPresent } from "../lib/text.ts";
import { css } from "../styles/css.ts";
import { color, size, space } from "../styles/tokens.stylex.ts";
import { Badge } from "./badge.tsx";
import { CollectionCompare, firstToLatestHref } from "./collection-compare.tsx";
import { CollectionFacts } from "./collection-facts.tsx";
import { CollectionHistory } from "./collection-timeline.tsx";
import { CollectionVersions } from "./collection-versions.tsx";
import { Breadcrumbs, DocLayout } from "./doc-layout.tsx";
import { LawText } from "./law-text.tsx";
import { Toc } from "./law-toc.tsx";
import { MergedBanner } from "./merged-banner.tsx";

const styles = stylex.create({
  meta: {
    gap: `${space.s2} ${space.s4}`,
    alignItems: "center",
    display: "flex",
    flexWrap: "wrap",
  },
  muted: { color: color.textMuted, fontSize: size.sm },
});

const crumbs = (collection: Collection, dated: boolean) => {
  const date = collection.merged?.date;

  return dated
    ? [
        { href: "/koleksi/", label: "Koleksi" },
        {
          href: collection.path.replace(/[^/]+\/$/u, ""),
          label: collection.name,
        },
        { label: isPresent(date) ? tanggal(date) : "tanggal tidak diketahui" },
      ]
    : [{ href: "/koleksi/", label: "Koleksi" }, { label: collection.name }];
};

const MergedHeadMeta = (props: {
  version: NonNullable<Collection["merged"]>;
}) => (
  <div class={css(styles.meta)}>
    <Show when={props.version.status}>
      {(status) => <Badge tone={status().key}>{status().label}</Badge>}
    </Show>
    <span class={css(styles.muted)}>
      Versi {isPresent(props.version.date) ? tanggal(props.version.date) : "?"}{" "}
      · setelah{" "}
      {props.version.amendments.map((entry) => entry.label).join(" dan ")}
    </span>
    <Show when={props.version.amended > 0}>
      <Badge tone="diubah">diubah {props.version.amended}×</Badge>
    </Show>
  </div>
);

const MergedCollection = (props: {
  collection: Collection;
  version: NonNullable<Collection["merged"]>;
  comparison: CollectionComparisonView | null;
  dated: boolean;
}) => {
  const spanText = useSpanText(() => ({
    slug: props.collection.slug,
    comparison: props.comparison,
    pageDate: props.version.date,
    pageText: props.version.text,
    listed: props.version.versions,
  }));

  const comparing = () => (props.comparison?.chosen.length ?? 0) > 0;

  return (
    <DocLayout
      crumbs={crumbs(props.collection, props.dated)}
      flushCrumbs
      eyebrow={`${props.version.baseTitle}, versi gabungan`}
      title={props.version.title}
      subtitle={props.collection.named ? props.collection.title : undefined}
      headMeta={<MergedHeadMeta version={props.version} />}
      text={props.version.text}
      comparing={props.comparison?.requested === true}
      panelLabel="Daftar isi"
      panel={
        <>
          <CollectionVersions
            versions={props.version.versions}
            current={props.collection.path}
            compareHref={
              props.comparison === null
                ? undefined
                : firstToLatestHref(props.comparison)
            }
          />
          <Toc text={props.version.text} />
          <CollectionFacts facts={props.version.facts} />
        </>
      }
    >
      <MergedBanner version={props.version} />
      {props.comparison !== null && (
        <CollectionCompare
          comparison={props.comparison}
          onDemand
          text={spanText()}
        />
      )}
      <Show when={!comparing()}>
        <LawText text={props.version.text} notes={props.version.notes} />
      </Show>
    </DocLayout>
  );
};

export const CollectionReader = (props: {
  collection: Collection;
  comparison: CollectionComparisonView | null;
  dated: boolean;
}) => (
  <Show
    when={props.collection.merged}
    fallback={
      <main>
        <Breadcrumbs crumbs={crumbs(props.collection, props.dated)} flush />
        {props.collection.timeline !== null && (
          <CollectionHistory
            name={props.collection.name}
            subtitle={
              props.collection.named ? props.collection.title : undefined
            }
            timeline={props.collection.timeline}
            comparison={props.comparison}
          />
        )}
      </main>
    }
    keyed
  >
    {(merged) => (
      <MergedCollection
        collection={props.collection}
        version={merged}
        comparison={props.comparison}
        dated={props.dated}
      />
    )}
  </Show>
);
