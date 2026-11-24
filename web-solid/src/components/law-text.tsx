import type { JSX } from "@solidjs/web";
import * as stylex from "@stylexjs/stylex";
import { createMemo, For, Show } from "solid-js";

import {
  modernHeading,
  modernLabel,
  pasalKey,
} from "../../../web/src/lib/display.ts";
import type { AknNode } from "../../../web/src/lib/lawdoc.ts";
import type { MergeNote } from "../../../web/src/lib/merge.ts";
import { isPresent } from "../lib/text.ts";
import type { Amendment } from "../server/records/law.ts";
import type { ReaderText } from "../server/records/reader-text.ts";
import { css } from "../styles/css.ts";
import { ArticleChange } from "./article-change.tsx";

const styles = stylex.create({
  numbered: {
    gap: "var(--s-1)",
    display: "grid",
    gridTemplateColumns: "var(--hang) minmax(0, 1fr)",
  },
  permalink: {
    marginInlineStart: "var(--s-2)",
  },
});

const headingLabels = new Map([
  ["article", "Pasal"],
  ["chapter", "BAB"],
  ["part", "Bagian"],
  ["subpart", "Paragraf"],
]);

const noteLabels = {
  diubah: "Diubah oleh",
  disisipkan: "Disisipkan oleh",
  dihapus: "Dihapus oleh",
  unreadable: "Diubah oleh",
};

const ReadingLabel = (props: { original: string; modern: string }) => (
  <Show when={props.original !== props.modern} fallback={props.original}>
    <span class="original-label">{props.original}</span>
    <span class="modern-label" data-pagefind-ignore>
      {props.modern}
    </span>
  </Show>
);

const ArticleNote = (props: { note: MergeNote }) => (
  <p data-pagefind-ignore>
    {noteLabels[props.note.kind]}{" "}
    {props.note.href === undefined ? (
      props.note.label
    ) : (
      <a href={props.note.href}>{props.note.label}</a>
    )}
    {props.note.kind === "unreadable" && "; teks baru belum terbaca"}
  </p>
);

const DocumentSection = (props: {
  node: AknNode;
  label: string;
  id?: string;
  alias?: string;
  explanation?: boolean;
  children: JSX.Element;
  changes?: Amendment["changes"];
  notes?: MergeNote[];
}) => {
  const numbered = (label: string) =>
    isPresent(props.node.num) ? `${label} ${props.node.num}` : undefined;

  const heading = () =>
    [numbered(props.label), props.node.heading].filter(isPresent).join(" ");

  const modern = () =>
    [
      numbered(props.label === "BAB" ? "Bab" : props.label),
      isPresent(props.node.heading)
        ? modernHeading(props.node.heading)
        : undefined,
    ]
      .filter(isPresent)
      .join(" ");

  const permalink = () => props.alias ?? props.id;

  const headingLabel = () => (
    <ReadingLabel original={heading()} modern={modern()} />
  );

  return (
    <section id={props.id}>
      {isPresent(props.alias) && <span id={props.alias} />}
      {props.node.tag === "article" ? (
        <h3 id={isPresent(props.id) ? `${props.id}-h` : undefined}>
          {props.explanation === true && isPresent(props.node.num) ? (
            <a href={`#pasal-${pasalKey(props.node.num)}`}>{headingLabel()}</a>
          ) : (
            headingLabel()
          )}
          {isPresent(permalink()) && props.explanation !== true && (
            <a
              class={css(styles.permalink)}
              href={`#${permalink()}`}
              aria-label={`Tautan ke ${heading()}`}
              data-pagefind-ignore
            >
              #
            </a>
          )}
        </h3>
      ) : (
        <h2>{headingLabel()}</h2>
      )}
      <For each={props.notes}>{(note) => <ArticleNote note={note} />}</For>
      <div
        id={
          isPresent(props.id) && props.explanation !== true
            ? `${props.id}-c`
            : undefined
        }
      >
        {props.children}
      </div>
      <For each={props.changes}>
        {(change) => <ArticleChange change={change} />}
      </For>
    </section>
  );
};

const elementId = (node: AknNode, explanation: boolean) => {
  const prefix = explanation ? "penjelasan-" : "";

  return isPresent(node.eId) ? `${prefix}${node.eId}` : undefined;
};

interface DocumentNodesProps {
  nodes: readonly AknNode[];
  anchors?: Readonly<Record<string, string>>;
  explanation?: boolean;
  changes?: ReadonlyMap<string, Amendment["changes"]>;
  notes?: Record<string, MergeNote[]>;
}

const DocumentNodes = (props: DocumentNodesProps) => (
  <For each={props.nodes}>
    {(node) => {
      const id = elementId(node, props.explanation === true);

      const alias =
        isPresent(id) &&
        props.anchors !== undefined &&
        Object.hasOwn(props.anchors, id)
          ? props.anchors[id]
          : undefined;

      const children = () => <DocumentNodes {...props} nodes={node.children} />;

      if (node.tag === "p") {
        return <p id={id}>{node.text}</p>;
      }

      const label = headingLabels.get(node.tag);

      if (label !== undefined) {
        return (
          <DocumentSection
            node={node}
            label={label}
            id={id}
            alias={alias}
            explanation={props.explanation}
            changes={
              alias === undefined ? undefined : props.changes?.get(alias)
            }
            notes={
              alias !== undefined &&
              isPresent(node.num) &&
              props.notes !== undefined &&
              Object.hasOwn(props.notes, node.num)
                ? props.notes[node.num]
                : undefined
            }
          >
            {children()}
          </DocumentSection>
        );
      }

      return (
        <div id={id} class={css(isPresent(node.num) && styles.numbered)}>
          {isPresent(node.num) && (
            <ReadingLabel
              original={node.num}
              modern={
                props.explanation === true ? modernLabel(node.num) : node.num
              }
            />
          )}
          <div>{children()}</div>
        </div>
      );
    }}
  </For>
);

export const LawText = (props: {
  text: ReaderText;
  amendment?: Amendment;
  notes?: Record<string, MergeNote[]>;
}) => {
  const changes = createMemo(() =>
    Map.groupBy(
      props.amendment?.changes ?? [],
      (change) => `pasal-${pasalKey(change.num)}`
    )
  );

  const unplacedChanges = createMemo(() => {
    if (!props.amendment) {
      return [];
    }

    const anchors = new Set(Object.values(props.text.anchors));

    return props.amendment.changes.filter(
      (change) => !anchors.has(`pasal-${pasalKey(change.num)}`)
    );
  });

  return (
    <>
      <fieldset data-pagefind-ignore>
        <legend>Format teks</legend>
        <label>
          <input type="radio" name="format" value="modern" checked /> Modern
        </label>
        <label>
          <input type="radio" name="format" value="asli" /> Asli
        </label>
      </fieldset>
      <article class="law" data-pagefind-body>
        <DocumentNodes nodes={props.text.preface} />
        {props.text.preamble.length > 0 && (
          <details open>
            <summary>Pembukaan</summary>
            <DocumentNodes nodes={props.text.preamble} />
          </details>
        )}
        <DocumentNodes
          nodes={props.text.body}
          anchors={props.text.anchors}
          changes={changes()}
          notes={props.notes}
        />
        <For each={unplacedChanges()}>
          {(change) => <ArticleChange change={change} />}
        </For>
        {props.text.conclusions.length > 0 && (
          <section id="penutup">
            <h2>Pengesahan dan pengundangan</h2>
            <DocumentNodes nodes={props.text.conclusions} />
          </section>
        )}
        {props.text.penjelasan.length > 0 && (
          <section id="penjelasan">
            <h2>Penjelasan</h2>
            <DocumentNodes nodes={props.text.penjelasan} explanation />
          </section>
        )}
      </article>
    </>
  );
};
