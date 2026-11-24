import type { JSX } from "@solidjs/web";
import * as stylex from "@stylexjs/stylex";
import { usePreference } from "@ui-sdk/solid/preferences";
import { createEffect, createMemo, For, Match, Show, Switch } from "solid-js";

import {
  cukupJelas,
  modernHeading,
  modernLabel,
  pasalKey,
} from "../../../web/src/lib/display.ts";
import type { AknNode } from "../../../web/src/lib/lawdoc.ts";
import type { MergeNote } from "../../../web/src/lib/merge.ts";
import { format, penjelasan } from "../lib/reading-preferences.ts";
import { isPresent } from "../lib/text.ts";
import type {
  ChangedPasal,
  VersionComparison,
} from "../server/law-comparison.ts";
import type { ReaderText } from "../server/records/reader-text.ts";
import { css } from "../styles/css.ts";
import { reading } from "../styles/reading.ts";
import { color, font, reader, size, space } from "../styles/tokens.stylex.ts";
import { AddedPasal, PasalComparison } from "./law-compare.tsx";

const ASLI = ':is([data-format="asli"])';
const PER_PASAL = ':is([data-penjelasan="pasal"])';
const NO_PENJELASAN = ':is([data-penjelasan="sembunyi"])';
const NO_CUKUP_JELAS = ':is([data-cj="hide"])';
const NO_PEMBUKAAN = ':is([data-pembukaan="hide"])';
const NO_BATANG = ':is([data-batang="hide"])';
const NO_PENUTUP = ':is([data-penutup="hide"])';
const ONLY_CHANGED = ":has([data-cmp-only]:checked)";

const styles = stylex.create({
  numbered: {
    gap: space.s1,
    display: "grid",
    gridTemplateColumns: `${size.hang} minmax(0, 1fr)`,
  },
  paragraph: { margin: 0, marginBlockEnd: space.s2 },
  permalink: { marginInlineStart: space.s2 },
  alias: { display: "block", scrollMarginBlockStart: space.s4 },
  article: { scrollMarginBlockStart: space.s4 },
  unchanged: {
    display: {
      default: null,
      [stylex.when.ancestor(ONLY_CHANGED)]: "none",
    },
  },
  prefaceBlock: {
    display: {
      default: "none",
      [stylex.when.ancestor(ASLI)]: "block",
      [stylex.when.ancestor(NO_PEMBUKAAN)]: "none",
    },
  },
  prefaceParagraph: {
    fontWeight: {
      default: null,
      [stylex.when.ancestor(ASLI)]: 600,
    },
    marginBlockEnd: {
      default: space.s2,
      [stylex.when.ancestor(ASLI)]: space.s5,
    },
    textAlign: {
      default: null,
      [stylex.when.ancestor(ASLI)]: "center",
    },
  },
  preamble: {
    borderBlockStyle: {
      default: "solid",
      [stylex.when.ancestor(ASLI)]: "none",
    },
    borderBlockColor: color.line,
    borderBlockWidth: 1,
    display: {
      default: null,
      [stylex.when.ancestor(NO_PEMBUKAAN)]: "none",
    },
    fontSize: {
      default: size.base,
      [stylex.when.ancestor(ASLI)]: "inherit",
    },
    marginBlockEnd: {
      default: 0,
      [stylex.when.ancestor(ASLI)]: space.s6,
    },
  },
  preambleSummary: {
    gap: `${space.s1} ${space.s3}`,
    paddingBlock: space.s3,
    alignItems: "baseline",
    cursor: "pointer",
    display: {
      default: "flex",
      [stylex.when.ancestor(ASLI)]: "none",
    },
    flexWrap: "wrap",
    fontFamily: font.ui,
    minBlockSize: reader.tap,
  },
  summaryTitle: { fontWeight: 600 },
  summaryMeta: { color: color.textMuted, fontSize: size.sm },
  body: {
    display: {
      default: null,
      [stylex.when.ancestor(NO_BATANG)]: "none",
    },
  },
  chapter: {
    marginBlock: {
      default: `${space.s7} ${space.s3}`,
      [stylex.when.ancestor(ASLI)]: `${space.s7} ${space.s4}`,
    },
    borderBlockStartColor: color.line,
    borderBlockStartStyle: {
      default: "solid",
      [stylex.when.ancestor(ASLI)]: "none",
    },
    borderBlockStartWidth: 1,
    fontFamily: {
      default: font.ui,
      [stylex.when.ancestor(ASLI)]: "inherit",
    },
    fontSize: {
      default: size.xl,
      [stylex.when.ancestor(ASLI)]: "1em",
    },
    fontWeight: 600,
    lineHeight: {
      default: 1.3,
      [stylex.when.ancestor(ASLI)]: 1.5,
    },
    paddingBlockStart: {
      default: space.s4,
      [stylex.when.ancestor(ASLI)]: 0,
    },
    textAlign: {
      default: null,
      [stylex.when.ancestor(ASLI)]: "center",
    },
  },
  part: {
    marginBlock: {
      default: `${space.s6} ${space.s2}`,
      [stylex.when.ancestor(ASLI)]: `${space.s7} ${space.s4}`,
    },
    borderBlockStartStyle: "none",
    fontSize: {
      default: size.lg,
      [stylex.when.ancestor(ASLI)]: "1em",
    },
    paddingBlockStart: 0,
  },
  subpart: {
    color: {
      default: color.textMuted,
      [stylex.when.ancestor(ASLI)]: "inherit",
    },
    fontSize: {
      default: reader.textMd,
      [stylex.when.ancestor(ASLI)]: "1em",
    },
  },
  headingNumber: {
    color: {
      default: color.textMuted,
      [stylex.when.ancestor(ASLI)]: null,
    },
    fontWeight: {
      default: 400,
      [stylex.when.ancestor(ASLI)]: 600,
    },
    marginInlineEnd: {
      default: space.s2,
      [stylex.when.ancestor(ASLI)]: 0,
    },
  },
  headingSub: {
    display: {
      default: "inline",
      [stylex.when.ancestor(ASLI)]: "block",
    },
  },
  articleHeading: {
    marginBlock: {
      default: `${space.s4} ${space.s2}`,
      [stylex.when.ancestor(ASLI)]: `${space.s6} ${space.s3}`,
    },
    fontFamily: {
      default: font.ui,
      [stylex.when.ancestor(ASLI)]: "inherit",
    },
    fontSize: {
      default: reader.textMd,
      [stylex.when.ancestor(ASLI)]: "1em",
    },
    fontWeight: 600,
    lineHeight: {
      default: null,
      [stylex.when.ancestor(ASLI)]: 1.5,
    },
    position: "relative",
    textAlign: {
      default: null,
      [stylex.when.ancestor(ASLI)]: "center",
    },
  },
  note: {
    margin: 0,
    color: color.warn,
    fontFamily: font.ui,
    fontSize: size.sm,
    marginBlockEnd: space.s3,
    textAlign: {
      default: null,
      [stylex.when.ancestor(ASLI)]: "center",
    },
  },
  noteWarn: {
    borderRadius: size.radius,
    paddingBlock: space.s1,
    paddingInline: space.s2,
    backgroundColor: color.backgroundSubtle,
    color: color.text,
  },
  conclusions: {
    display: {
      default: null,
      [stylex.when.ancestor(NO_PENUTUP)]: "none",
    },
    fontFamily: {
      default: font.ui,
      [stylex.when.ancestor(ASLI)]: "inherit",
    },
    fontSize: {
      default: size.sm,
      [stylex.when.ancestor(ASLI)]: "inherit",
    },
    marginBlockStart: space.s7,
  },
  hiddenInAsli: {
    display: {
      default: null,
      [stylex.when.ancestor(ASLI)]: "none",
    },
  },
  penjelasan: {
    borderBlockStartColor: color.line,
    borderBlockStartStyle: {
      default: "none",
      [stylex.when.ancestor(ASLI)]: "solid",
    },
    borderBlockStartWidth: 2,
    display: {
      default: null,
      [stylex.when.ancestor(NO_PENJELASAN)]: "none",
    },
    marginBlockStart: 64,
    paddingBlockStart: {
      default: 0,
      [stylex.when.ancestor(ASLI)]: space.s6,
    },
  },
  penjelasanTitle: {
    display: {
      default: null,
      [stylex.when.ancestor(ASLI)]: "none",
    },
  },
  pdp: {
    display: {
      default: null,
      [stylex.when.ancestor(PER_PASAL)]: "none",
    },
  },
  pjLabel: {
    display: {
      default: "none",
      [stylex.when.ancestor(PER_PASAL)]: "inline",
    },
  },
  pjPasal: {
    display: {
      default: null,
      [stylex.when.ancestor(PER_PASAL)]: "none",
    },
  },
  pjEntry: {
    borderInlineStartColor: {
      default: null,
      [stylex.when.ancestor(PER_PASAL)]: color.line,
    },
    borderInlineStartStyle: {
      default: null,
      [stylex.when.ancestor(PER_PASAL)]: "solid",
    },
    borderInlineStartWidth: {
      default: 0,
      [stylex.when.ancestor(PER_PASAL)]: 2,
    },
    display: {
      default: null,
      [stylex.when.ancestor(NO_PENJELASAN)]: "none",
    },
    fontFamily: {
      default: null,
      [stylex.when.ancestor(PER_PASAL)]: font.ui,
    },
    fontSize: {
      default: null,
      [stylex.when.ancestor(PER_PASAL)]: size.sm,
    },
    paddingInlineStart: {
      default: 0,
      [stylex.when.ancestor(PER_PASAL)]: space.s4,
    },
  },
  cukupJelas: {
    display: {
      default: null,
      [stylex.when.ancestor(NO_CUKUP_JELAS)]: "none",
    },
  },
});

const headingLabels = new Map([
  ["article", "Pasal"],
  ["chapter", "BAB"],
  ["part", "Bagian"],
  ["subpart", "Paragraf"],
]);

const headingStyle = (tag: string) => {
  if (tag === "part") {
    return styles.part;
  }

  return tag === "subpart" ? styles.subpart : undefined;
};

const noteLabels = {
  diubah: "Diubah oleh",
  disisipkan: "Disisipkan oleh",
  dihapus: "Dihapus oleh",
  unreadable: "Diubah oleh",
};

export interface PasalNote {
  kind?: MergeNote["kind"];
  label: string;
  href?: string;
  by?: string;
}

const ReadingLabel = (props: { original: string; modern: string }) => (
  <Show when={props.original !== props.modern} fallback={props.original}>
    <span class={css(reading.originalLabel)}>{props.original}</span>
    <span class={css(reading.modernLabel)} data-pagefind-ignore>
      {props.modern}
    </span>
  </Show>
);

const noteGroups = (notes: PasalNote[]) => {
  const groups = new Map<keyof typeof noteLabels, PasalNote[]>();

  for (const note of notes) {
    const kind = note.kind ?? "diubah";

    groups.set(kind, [...(groups.get(kind) ?? []), note]);
  }

  return [...groups];
};

const joiner = (index: number, count: number) => {
  if (index === 0) {
    return "";
  }

  return index === count - 1 ? " dan " : ", ";
};

const ArticleNotes = (props: { notes: PasalNote[]; num: string }) => (
  <For each={noteGroups(props.notes)}>
    {([kind, list]) => (
      <p
        class={css(styles.note, kind === "unreadable" && styles.noteWarn)}
        data-pagefind-ignore
      >
        {noteLabels[kind]}{" "}
        <For each={list}>
          {(note, index) => (
            <>
              {joiner(index(), list.length)}
              {isPresent(note.href) ? (
                <a href={note.href}>{note.label}</a>
              ) : (
                note.label
              )}
              {isPresent(note.by) && (
                <>
                  {" ("}
                  <a
                    href={`?bandingkan=${note.by}#pasal-${pasalKey(props.num)}`}
                  >
                    bandingkan
                  </a>
                  {")"}
                </>
              )}
            </>
          )}
        </For>
        {kind === "unreadable" &&
          "; teks barunya belum terbaca, di bawah ini teks sebelumnya"}
      </p>
    )}
  </For>
);

const Permalink = (props: { target: string; label: string }) => (
  <a
    class={css(styles.permalink)}
    href={`#${props.target}`}
    target="_self"
    aria-label={`Tautan ke ${props.label}`}
    data-pagefind-ignore
  >
    #
  </a>
);

const ArticleSection = (props: {
  node: AknNode;
  id?: string;
  alias?: string;
  notes?: PasalNote[];
  compare?: ChangedPasal;
  flipped: boolean;
  children: JSX.Element;
}) => {
  const heading = () => `Pasal ${props.node.num ?? ""}`.trim();
  const permalink = () => props.alias ?? props.id;

  return (
    <section
      id={props.id}
      data-num={props.node.num}
      data-compared={props.compare === undefined ? undefined : ""}
      class={css(
        styles.article,
        props.compare === undefined && styles.unchanged
      )}
    >
      {isPresent(props.alias) && (
        <span id={props.alias} class={css(styles.alias)} />
      )}
      <h3
        id={isPresent(props.id) ? `${props.id}-h` : undefined}
        class={css(styles.articleHeading)}
      >
        {heading()}
        {isPresent(permalink()) && (
          <Permalink target={permalink() ?? ""} label={heading()} />
        )}
      </h3>
      <Show when={props.notes}>
        {(notes) => <ArticleNotes notes={notes()} num={props.node.num ?? ""} />}
      </Show>
      <Show
        when={props.compare}
        fallback={
          <div id={isPresent(props.id) ? `${props.id}-c` : undefined}>
            {props.children}
          </div>
        }
      >
        {(block) => <PasalComparison block={block()} flipped={props.flipped} />}
      </Show>
    </section>
  );
};

const HeadingSection = (props: {
  node: AknNode;
  label: string;
  id?: string;
  children: JSX.Element;
}) => {
  const numbered = (label: string) =>
    isPresent(props.node.num) ? `${label} ${props.node.num}` : undefined;

  const original = () => numbered(props.label);
  const modern = () => numbered(props.label === "BAB" ? "Bab" : props.label);
  const heading = () => props.node.heading;

  return (
    <section id={props.id}>
      <h2 class={css(styles.chapter, headingStyle(props.node.tag))}>
        <span class={css(styles.headingNumber)}>
          <ReadingLabel original={original() ?? ""} modern={modern() ?? ""} />
        </span>
        {isPresent(heading()) && (
          <>
            {" "}
            <span class={css(styles.headingSub)}>
              <ReadingLabel
                original={heading() ?? ""}
                modern={modernHeading(heading() ?? "")}
              />
            </span>
          </>
        )}
      </h2>
      {props.children}
    </section>
  );
};

const PASAL_DEMI_PASAL = /pasal\s+demi\s+pasal/iu;
const PENJELASAN_TITLE = /^penjelasan$/iu;

const ExplanationHeading = (props: {
  node: AknNode;
  label: string;
  id?: string;
  children: JSX.Element;
}) => {
  const heading = () => props.node.heading ?? "";

  const isTitle = () =>
    props.node.tag === "part" &&
    !isPresent(props.node.num) &&
    PENJELASAN_TITLE.test(heading());

  const isPdp = () =>
    props.node.tag === "part" && PASAL_DEMI_PASAL.test(heading());

  const number = () =>
    props.node.tag === "part"
      ? props.node.num
      : `${props.label} ${props.node.num ?? ""}`.trim();

  return (
    <section
      id={props.id}
      class={css(isPdp() && styles.pdp, isTitle() && styles.penjelasanTitle)}
    >
      <Show when={!isTitle()}>
        <h2 class={css(styles.chapter, styles.part)}>
          {number()}
          {isPresent(heading()) && (
            <>
              {" "}
              <span class={css(styles.headingSub)}>
                <ReadingLabel
                  original={heading()}
                  modern={modernHeading(heading())}
                />
              </span>
            </>
          )}
        </h2>
      </Show>
      {props.children}
    </section>
  );
};

interface DocumentNodesProps {
  nodes: readonly AknNode[];
  anchors?: Readonly<Record<string, string>>;
  explanation?: boolean;
  notes?: Record<string, PasalNote[]>;
  comparison?: CompareIndex;
}

interface CompareIndex {
  flipped: boolean;
  blocks: ReadonlyMap<string, ChangedPasal>;
  after: Readonly<Record<string, ChangedPasal[]>>;
}

const elementId = (node: AknNode, explanation: boolean) => {
  const prefix = explanation ? "penjelasan-" : "";

  return isPresent(node.eId) ? `${prefix}${node.eId}` : undefined;
};

const ExplanationEntry = (props: {
  node: AknNode;
  id?: string;
  children: JSX.Element;
}) => {
  const key = () =>
    isPresent(props.node.num) ? pasalKey(props.node.num) : undefined;

  const label = () => `Pasal ${props.node.num ?? ""}`.trim();

  return (
    <section
      id={props.id}
      data-pj-for={key()}
      class={css(styles.pjEntry, cukupJelas(props.node) && styles.cukupJelas)}
    >
      <h3
        id={isPresent(props.id) ? `${props.id}-h` : undefined}
        class={css(styles.articleHeading)}
      >
        <span class={css(styles.pjPasal)}>
          {isPresent(key()) ? (
            <a href={`#pasal-${key()}`} target="_self">
              {label()}
            </a>
          ) : (
            label()
          )}
        </span>
        <span class={css(styles.pjLabel)}>Penjelasan</span>
      </h3>
      {props.children}
    </section>
  );
};

const aliasOf = (
  id: string | undefined,
  anchors: DocumentNodesProps["anchors"]
) =>
  isPresent(id) && anchors !== undefined && Object.hasOwn(anchors, id)
    ? anchors[id]
    : undefined;

const noteOf = (
  alias: string | undefined,
  node: AknNode,
  notes: DocumentNodesProps["notes"]
) =>
  alias !== undefined &&
  isPresent(node.num) &&
  notes !== undefined &&
  Object.hasOwn(notes, node.num)
    ? notes[node.num]
    : undefined;

const DocumentNode = (
  props: Omit<DocumentNodesProps, "nodes"> & { node: AknNode }
) => {
  const explanation = () => props.explanation === true;
  const id = () => elementId(props.node, explanation());
  const alias = () => aliasOf(id(), props.anchors);
  const label = () => headingLabels.get(props.node.tag);
  const flipped = () => props.comparison?.flipped === true;

  const compare = () =>
    alias() !== undefined && isPresent(props.node.num)
      ? props.comparison?.blocks.get(props.node.num)
      : undefined;

  const added = () =>
    (isPresent(props.node.eId)
      ? props.comparison?.after[props.node.eId]
      : undefined) ?? [];

  const children = () => (
    <DocumentNodes
      nodes={props.node.children}
      anchors={props.anchors}
      explanation={props.explanation}
      notes={props.notes}
      comparison={props.comparison}
    />
  );

  return (
    <Switch
      fallback={
        <div
          id={id()}
          class={css(isPresent(props.node.num) && styles.numbered)}
        >
          <Show when={props.node.num}>
            {(num) => (
              <ReadingLabel
                original={num()}
                modern={explanation() ? modernLabel(num()) : num()}
              />
            )}
          </Show>
          <div>{children()}</div>
        </div>
      }
    >
      <Match when={props.node.tag === "p"}>
        <p id={id()} class={css(styles.paragraph)}>
          {props.node.text}
        </p>
      </Match>
      <Match when={props.node.tag === "article" && explanation()}>
        <ExplanationEntry node={props.node} id={id()}>
          {children()}
        </ExplanationEntry>
      </Match>
      <Match when={props.node.tag === "article"}>
        <ArticleSection
          node={props.node}
          id={id()}
          alias={alias()}
          compare={compare()}
          flipped={flipped()}
          notes={noteOf(alias(), props.node, props.notes)}
        >
          {children()}
        </ArticleSection>
        <For each={added()}>
          {(block) => <AddedPasal block={block} flipped={flipped()} />}
        </For>
      </Match>
      <Match when={label() !== undefined && explanation()}>
        <ExplanationHeading node={props.node} label={label() ?? ""} id={id()}>
          {children()}
        </ExplanationHeading>
      </Match>
      <Match when={label() !== undefined}>
        <HeadingSection node={props.node} label={label() ?? ""} id={id()}>
          {children()}
        </HeadingSection>
      </Match>
    </Switch>
  );
};

const DocumentNodes = (props: DocumentNodesProps) => (
  <For each={props.nodes}>
    {(node) => (
      <DocumentNode
        node={node}
        anchors={props.anchors}
        explanation={props.explanation}
        notes={props.notes}
        comparison={props.comparison}
      />
    )}
  </For>
);

const openingSummary = (preamble: readonly AknNode[]) =>
  preamble.flatMap((node, index) => {
    const heading =
      node.tag === "p"
        ? /^(?<name>Menimbang|Mengingat|Memperhatikan)\b/iu.exec(
            node.text ?? ""
          )
        : null;

    if (heading === null) {
      return [];
    }

    const count =
      preamble[index + 1]?.tag === "blockList"
        ? preamble[index + 1].children.length
        : 0;

    return [
      count > 0 ? `${heading.groups?.name} (${count})` : heading.groups?.name,
    ];
  });

const placeExplanations = (law: HTMLElement, under: boolean) => {
  for (const entry of law.querySelectorAll<HTMLElement>("[data-pj-for]")) {
    const home = law.querySelector(`[data-pj-home="${entry.id}"]`);

    if (under && home === null) {
      const anchor = document.querySelector(
        `#pasal-${CSS.escape(entry.dataset.pjFor ?? "")}`
      );

      const target = anchor?.parentElement?.querySelector(
        ":scope > [id$='-c']"
      );

      if (target) {
        const marker = document.createElement("span");

        marker.hidden = true;
        marker.dataset.pjHome = entry.id;
        entry.before(marker);
        target.append(entry);
      }
    } else if (!under && home !== null) {
      home.replaceWith(entry);
    }
  }
};

const indexComparison = (comparison: VersionComparison) => {
  const byNumber = new Map(
    comparison.changed.map((block) => [block.num, block])
  );

  return {
    flipped: comparison.left > comparison.right,
    blocks: byNumber,
    after: Object.fromEntries(
      Object.entries(comparison.after).map(([eId, nums]) => [
        eId,
        nums.flatMap((num) => byNumber.get(num) ?? []),
      ])
    ),
  } satisfies CompareIndex;
};

export const LawText = (props: {
  text: ReaderText;
  notes?: Record<string, PasalNote[]>;
  comparison?: VersionComparison;
}) => {
  let law: HTMLElement | undefined;
  let preamble: HTMLDetailsElement | undefined;
  const placement = usePreference(penjelasan);
  const current = usePreference(format);

  createEffect(
    () => placement().value,
    (value) => {
      if (law) {
        placeExplanations(law, value === "pasal");
      }
    }
  );

  createEffect(
    () => current().value,
    (value) => {
      if (preamble) {
        preamble.open = value === "asli";
      }
    }
  );

  const compareIndex = createMemo(
    () => props.comparison && indexComparison(props.comparison)
  );

  return (
    <article
      class={css(reading.law)}
      data-law
      data-pagefind-body
      ref={(element: HTMLElement) => {
        law = element;
      }}
    >
      <Show when={props.text.preface.length > 0}>
        <div class={css(styles.prefaceBlock)}>
          <For each={props.text.preface}>
            {(node) => (
              <p class={css(styles.prefaceParagraph)} id={node.eId}>
                {node.text}
              </p>
            )}
          </For>
        </div>
      </Show>
      <Show when={props.text.preamble.length > 0}>
        <details
          open
          class={css(styles.preamble)}
          ref={(element: HTMLDetailsElement) => {
            preamble = element;
          }}
        >
          <summary class={css(styles.preambleSummary)}>
            <span class={css(styles.summaryTitle)}>Pembukaan</span>
            <span class={css(styles.summaryMeta)}>
              {openingSummary(props.text.preamble).join(" · ")}
            </span>
          </summary>
          <DocumentNodes nodes={props.text.preamble} />
        </details>
      </Show>
      <div class={css(styles.body)}>
        <DocumentNodes
          nodes={props.text.body}
          anchors={props.text.anchors}
          notes={props.notes}
          comparison={compareIndex()}
        />
      </div>
      <Show when={props.text.conclusions.length > 0}>
        <section id="penutup" class={css(styles.conclusions)}>
          <h2 class={css(styles.hiddenInAsli)}>Pengesahan dan pengundangan</h2>
          <DocumentNodes nodes={props.text.conclusions} />
        </section>
      </Show>
      <Show when={props.text.penjelasan.length > 0}>
        <section id="penjelasan" class={css(styles.penjelasan)}>
          <h2 class={css(styles.penjelasanTitle)}>Penjelasan</h2>
          <DocumentNodes nodes={props.text.penjelasan} explanation />
        </section>
      </Show>
    </article>
  );
};
