import { createMemo, For, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import * as stylex from "@stylexjs/stylex";
import { modernHeading, modernLabel, pasalKey } from "../../web/src/lib/display.ts";
import type { AknNode } from "../../web/src/lib/lawdoc.ts";
import type { MergeNote } from "../../web/src/lib/merge.ts";
import type { ReaderLaw } from "./law-record.ts";
import { ArticleChange, type Amendment } from "./AmendmentComparison.tsx";

const headingLabels: Record<string, string> = {
  article: "Pasal", chapter: "BAB", part: "Bagian", subpart: "Paragraf",
};

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

interface DocumentNodesProps {
  nodes: readonly AknNode[];
  anchors?: Readonly<Record<string, string>>;
  explanation?: boolean;
  changes?: ReadonlyMap<string, Amendment["changes"]>;
  notes?: Record<string, MergeNote[]>;
}

function ReadingLabel(props: { original: string; modern: string }) {
  return <Show when={props.original !== props.modern} fallback={props.original}>
    <span class="original-label">{props.original}</span>
    <span class="modern-label" data-pagefind-ignore>{props.modern}</span>
  </Show>;
}

function DocumentNodes(props: DocumentNodesProps) {
  return <For each={props.nodes}>{(node) => {
    const id = node.eId && (props.explanation ? `penjelasan-${node.eId}` : node.eId);
    const anchors = props.anchors;
    const alias = id && anchors && Object.hasOwn(anchors, id) ? anchors[id] : undefined;
    const children = () => <DocumentNodes {...props} nodes={node.children} />;
    if (node.tag === "p") return <p id={id}>{node.text}</p>;
    if (Object.hasOwn(headingLabels, node.tag)) {
      return <DocumentSection node={node} id={id} alias={alias} explanation={props.explanation}
        changes={alias ? props.changes?.get(alias) : undefined}
        notes={alias && node.num && props.notes && Object.hasOwn(props.notes, node.num)
          ? props.notes[node.num] : undefined}>
        {children()}
      </DocumentSection>;
    }
    return <div id={id} class={stylex.props(Boolean(node.num) && styles.numbered).className}>
      {node.num && <ReadingLabel original={node.num} modern={props.explanation ? modernLabel(node.num) : node.num} />}
      <div>{children()}</div>
    </div>;
  }}</For>;
}

function DocumentSection(props: {
  node: AknNode; id?: string; alias?: string; explanation?: boolean; children: JSX.Element;
  changes?: Amendment["changes"];
  notes?: MergeNote[];
}) {
  const node = props.node;
  const label = headingLabels[node.tag];
  const heading = [node.num && `${label} ${node.num}`, node.heading].filter(Boolean).join(" ");
  const modern = [node.num && `${label === "BAB" ? "Bab" : label} ${node.num}`,
    node.heading && modernHeading(node.heading)].filter(Boolean).join(" ");
  const permalink = props.alias ?? props.id;
  const headingLabel = <ReadingLabel original={heading} modern={modern} />;
  return <section id={props.id}>
    {props.alias && <span id={props.alias} />}
    {node.tag === "article" ? <h3 id={props.id && `${props.id}-h`}>
      {props.explanation && node.num ? <a href={`#pasal-${pasalKey(node.num)}`}>{headingLabel}</a> : headingLabel}
      {permalink && !props.explanation && <a class={stylex.props(styles.permalink).className} href={`#${permalink}`} aria-label={`Tautan ke ${heading}`} data-pagefind-ignore>#</a>}
    </h3> : <h2>{headingLabel}</h2>}
    <For each={props.notes}>{(note) => <ArticleNote note={note} />}</For>
    <div id={props.id && !props.explanation ? `${props.id}-c` : undefined}>{props.children}</div>
    <For each={props.changes}>{(change) => <ArticleChange change={change} />}</For>
  </section>;
}

const noteLabels = {
  diubah: "Diubah oleh", disisipkan: "Disisipkan oleh", dihapus: "Dihapus oleh", unreadable: "Diubah oleh",
};

function ArticleNote(props: { note: MergeNote }) {
  return <p data-pagefind-ignore>
    {noteLabels[props.note.kind]}{" "}
    {props.note.href ? <a href={props.note.href}>{props.note.label}</a> : props.note.label}
    {props.note.kind === "unreadable" && "; teks baru belum terbaca"}
  </p>;
}

export function LawText(props: { text: NonNullable<ReaderLaw["text"]>; amendment?: Amendment; notes?: Record<string, MergeNote[]> }) {
  const changes = createMemo(() => Map.groupBy(props.amendment?.changes ?? [],
    (change) => `pasal-${pasalKey(change.num)}`));
  const unplacedChanges = createMemo(() => {
    if (!props.amendment) return [];
    const anchors = new Set(Object.values(props.text.anchors));
    return props.amendment.changes.filter((change) => !anchors.has(`pasal-${pasalKey(change.num)}`));
  });
  return <>
    <fieldset data-pagefind-ignore>
      <legend>Format teks</legend>
      <label><input type="radio" name="format" value="modern" checked /> Modern</label>
      <label><input type="radio" name="format" value="asli" /> Asli</label>
    </fieldset>
    <article class="law" data-pagefind-body>
      <DocumentNodes nodes={props.text.preface} />
      {props.text.preamble.length > 0 && <details open>
        <summary>Pembukaan</summary><DocumentNodes nodes={props.text.preamble} />
      </details>}
      <DocumentNodes nodes={props.text.body} anchors={props.text.anchors} changes={changes()} notes={props.notes} />
      <For each={unplacedChanges()}>{(change) => <ArticleChange change={change} />}</For>
      {props.text.conclusions.length > 0 && <section id="penutup">
        <h2>Pengesahan dan pengundangan</h2><DocumentNodes nodes={props.text.conclusions} />
      </section>}
      {props.text.penjelasan.length > 0 && <section id="penjelasan">
        <h2>Penjelasan</h2><DocumentNodes nodes={props.text.penjelasan} explanation />
      </section>}
    </article>
  </>;
}

export function LawReader(props: { law: ReaderLaw; amendment?: Amendment; comparisonRequested?: boolean }) {
  return <main class="law-reader">
    <header>
      <p>{props.law.title}</p>
      <h1>{props.law.subject || props.law.title}</h1>
      {props.law.hasAmendments && <p>
        <a href="./perubahan/">Riwayat perubahan</a>
        {" · "}
        {props.comparisonRequested ? <a href="./">Tutup perbandingan</a> : <a href="?bandingkan">Bandingkan</a>}
      </p>}
      {props.amendment && <p>Perubahan oleh {props.amendment.label}</p>}
      {props.comparisonRequested && !props.amendment && <p>Perbandingan versi ini belum tersedia.</p>}
      <ul aria-label="Sumber">
        <li><a href={props.law.source}>Halaman resmi</a></li>
        {props.law.pdf && <li><a href={props.law.pdf}>Unduh PDF</a></li>}
        {props.law.archive && <li><a href={props.law.archive}>Salinan arsip</a></li>}
      </ul>
    </header>
    {props.law.text ? <LawText text={props.law.text} amendment={props.amendment} /> : <p>Teks belum tersedia.</p>}
  </main>;
}
