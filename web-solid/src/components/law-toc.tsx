import * as stylex from "@stylexjs/stylex";
import { For, onSettled, Show } from "solid-js";

import { modernHeading, pasalKey } from "../lib/display.ts";
import { isPresent } from "../lib/text.ts";
import type { Mark, VersionComparison } from "../server/law-comparison.ts";
import type { AknNode, ReaderText } from "../server/records/reader-text.ts";
import { css } from "../styles/css.ts";
import { linkStyles } from "../styles/link.ts";
import { color, size, space } from "../styles/tokens.stylex.ts";
import { MarkIcon } from "./law-compare.tsx";
import { setAllFolds } from "./law-fold.tsx";
import { PasalJump } from "./pasal-jump.tsx";

const NO_PENJELASAN = ':is([data-penjelasan="sembunyi"])';

const current = ":is([aria-current])";

const styles = stylex.create({
  head: {
    gap: space.s2,
    alignItems: "baseline",
    display: "flex",
    justifyContent: "space-between",
    marginBlockEnd: space.s2,
  },
  title: {
    margin: 0,
    color: color.textMuted,
    fontSize: size.xs,
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  folds: {
    gap: space.s3,
    display: { default: "flex", "@media (scripting: none)": "none" },
  },
  foldButton: {
    font: "inherit",
    padding: 0,
    borderRadius: size.radius,
    borderWidth: 0,
    backgroundColor: "transparent",
    color: color.link,
    cursor: "pointer",
    fontSize: size.xs,
    minBlockSize: { default: null, "@media (pointer: coarse)": size.tap },
    outlineColor: color.link,
    outlineOffset: { default: null, ":focus-visible": 2 },
    outlineStyle: { default: null, ":focus-visible": "solid" },
    outlineWidth: { default: null, ":focus-visible": 3 },
    textDecorationLine: "underline",
    textDecorationThickness: { default: 1, ":hover": 2 },
    textUnderlineOffset: "0.15em",
  },
  list: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    borderInlineStartColor: color.line,
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: 1,
  },
  chapterLink: {
    paddingBlock: {
      default: space.s1,
      "@media (pointer: coarse)": space.s3,
    },
    paddingInline: space.s3,
    textDecoration: "none",
    borderInlineStartColor: {
      [current]: color.link,
      default: "transparent",
    },
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: 2,
    color: { [current]: color.link, default: color.text },
    display: "block",
    lineHeight: 1.35,
    marginInlineStart: -1,
  },
  label: {
    display: "block",
    fontSize: size.xs,
    fontWeight: 600,
    letterSpacing: "0.03em",
  },
  block: { display: "block" },
  range: { color: color.textMuted, display: "block", fontSize: size.xs },
  counts: {
    gap: space.s2,
    display: "flex",
    fontSize: size.xs,
    fontWeight: 600,
    marginBlockStart: space.hairline,
  },
  count: {
    gap: space.hairline,
    alignItems: "center",
    display: "inline-flex",
  },
  grid: {
    margin: 0,
    padding: 0,
    gap: space.s1,
    listStyle: "none",
    marginBlock: `${space.s1} ${space.s2}`,
    display: "flex",
    flexWrap: "wrap",
    marginInlineStart: space.s3,
  },
  cell: {
    borderRadius: size.radius,
    paddingInline: space.s1,
    placeItems: "center",
    textDecoration: {
      default: "none",
      ":is([data-mk=del])": "line-through",
    },
    backgroundColor: {
      [current]: color.linkBackground,
      default: null,
      ":is([data-mk=del])": color.delBackground,
      ":is([data-mk=ins])": color.insBackground,
      ":is([data-mk=mod])": color.modBackground,
    },
    color: {
      [current]: color.link,
      default: color.text,
      ":is([data-mk=del])": color.delText,
      ":is([data-mk=ins])": color.insText,
      ":is([data-mk=mod])": color.modText,
    },
    display: "grid",
    fontSize: size.xs,
    fontVariantNumeric: "tabular-nums",
    fontWeight: { [current]: 600, default: null, ":is([data-mk])": 600 },
    minBlockSize: {
      default: space.s6,
      "@media (pointer: coarse)": size.tap,
    },
    minInlineSize: {
      default: "2.25rem",
      "@media (pointer: coarse)": size.tap,
    },
  },
  summary: { listStyle: "none", cursor: "pointer" },
  penjelasan: {
    display: {
      default: null,
      [stylex.when.ancestor(NO_PENJELASAN)]: "none",
    },
  },
});

interface Cell {
  num: string;
  href: string;
  id?: string;
  mark?: Mark;
}

const articles = (root: AknNode) => {
  const found: AknNode[] = [];

  const visit = (node: AknNode) => {
    if (node.tag === "article") {
      found.push(node);
    } else {
      for (const child of node.children) {
        visit(child);
      }
    }
  };

  visit(root);

  return found;
};

const range = (cells: Cell[]) => {
  if (cells.length === 0) {
    return "";
  }

  return cells.length === 1
    ? `Pasal ${cells[0].num}`
    : `Pasal ${cells[0].num}–${cells.at(-1)?.num}`;
};

const cellsOf = (
  nodes: AknNode[],
  anchors: ReaderText["anchors"],
  comparison: VersionComparison | undefined
) => {
  const marks = new Map(
    comparison?.changed.map((block) => [block.num, block.mark])
  );

  return nodes
    .filter((node) => isPresent(node.num))
    .flatMap((node) => {
      const eId = node.eId ?? "";
      const alias = Object.hasOwn(anchors, eId) ? anchors[eId] : undefined;
      const num = node.num ?? "";

      const inserted = (comparison?.after[eId] ?? []).map(
        (insertedNum) =>
          ({
            num: insertedNum,
            href: `#cmp-pasal-${pasalKey(insertedNum)}`,
            id: `cmp-pasal-${pasalKey(insertedNum)}`,
            mark: marks.get(insertedNum) ?? "ins",
          }) satisfies Cell
      );

      return [
        {
          num,
          href: `#${alias ?? eId}`,
          id: eId,
          mark: alias === undefined ? undefined : marks.get(num),
        } satisfies Cell,
        ...inserted,
      ];
    });
};

const counts = (cells: Cell[]) => {
  const total: Record<Mark, number> = { mod: 0, ins: 0, del: 0 };

  for (const cell of cells) {
    if (cell.mark !== undefined) {
      total[cell.mark] += 1;
    }
  }

  return (["mod", "ins", "del"] as const).flatMap((mark) =>
    total[mark] > 0 ? [{ mark, count: total[mark] }] : []
  );
};

const PasalGrid = (props: { cells: Cell[]; label: string }) => (
  <ol class={css(styles.grid)} aria-label={props.label}>
    <For each={props.cells}>
      {(cell) => (
        <li>
          <a
            class={css(linkStyles.base, styles.cell)}
            href={cell.href}
            target="_self"
            data-pasal={cell.id}
            data-mk={cell.mark}
          >
            {cell.num}
          </a>
        </li>
      )}
    </For>
  </ol>
);

const Chapter = (props: {
  chapter: AknNode;
  anchors: ReaderText["anchors"];
  comparison?: VersionComparison;
}) => {
  const cells = () =>
    cellsOf(articles(props.chapter), props.anchors, props.comparison);

  const changes = () => counts(cells());

  return (
    <li data-ch={props.chapter.eId}>
      <details
        open={changes().length > 0}
        data-keep={changes().length > 0 ? "" : undefined}
      >
        <summary class={css(styles.summary)}>
          <a
            href={`#${props.chapter.eId}`}
            target="_self"
            class={css(linkStyles.base, styles.chapterLink)}
            data-ch-link={props.chapter.eId}
          >
            <span class={css(styles.label)}>Bab {props.chapter.num}</span>
            {isPresent(props.chapter.heading) && (
              <span class={css(styles.block)}>
                {modernHeading(props.chapter.heading)}
              </span>
            )}
            {cells().length > 0 && (
              <span class={css(styles.range)}>{range(cells())}</span>
            )}
            <Show when={changes().length > 0}>
              <span class={css(styles.counts)}>
                <For each={changes()}>
                  {(change) => (
                    <span class={css(styles.count)}>
                      <MarkIcon kind={change.mark} />
                      {change.count}
                    </span>
                  )}
                </For>
              </span>
            </Show>
          </a>
        </summary>
        <Show when={cells().length > 0}>
          <PasalGrid
            cells={cells()}
            label={`Pasal dalam Bab ${props.chapter.num}`}
          />
        </Show>
      </details>
    </li>
  );
};

const keepVisible = (link: HTMLElement) => {
  const pane = link.closest("aside");

  if (pane === null || pane.scrollHeight <= pane.clientHeight) {
    return;
  }

  const inner = link.getBoundingClientRect();
  const outer = pane.getBoundingClientRect();

  if (inner.top < outer.top || inner.bottom > outer.bottom) {
    pane.scrollTop += inner.top - outer.top - outer.height / 3;
  }
};

type LinkKind = "chLink" | "pasal";

const linksBy = (toc: HTMLElement, selector: string, kind: LinkKind) =>
  new Map(
    [...toc.querySelectorAll<HTMLElement>(selector)].flatMap((link) => {
      const id = link.dataset[kind];

      return id === undefined ? [] : [[id, link] as const];
    })
  );

const followReading = (toc: HTMLElement) => {
  const chapters = linksBy(toc, "[data-ch-link]", "chLink");
  const pasal = linksBy(toc, "[data-pasal]", "pasal");
  const marked = new Map<LinkKind, HTMLElement>();
  let opened: HTMLDetailsElement | null = null;

  const follow = (kind: LinkKind, link: HTMLElement) => {
    marked.get(kind)?.removeAttribute("aria-current");
    link.setAttribute("aria-current", "true");
    marked.set(kind, link);

    const details = link.closest("details");

    if (details !== null && details !== opened) {
      if (opened !== null && !Object.hasOwn(opened.dataset, "keep")) {
        opened.open = false;
      }

      details.open = true;
      opened = details;
    }

    keepVisible(link);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue;
        }

        const { id } = entry.target;
        const chapter = chapters.get(id);
        const cell = pasal.get(id);

        if (chapter !== undefined) {
          follow("chLink", chapter);
        }

        if (cell !== undefined) {
          follow("pasal", cell);
        }
      }
    },
    { rootMargin: "0px 0px -70% 0px" }
  );

  for (const id of [...chapters.keys(), ...pasal.keys()]) {
    const target = document.querySelector(`#${CSS.escape(id)}`);

    if (target !== null) {
      observer.observe(target);
    }
  }

  return () => {
    observer.disconnect();
  };
};

export const Toc = (props: {
  text: ReaderText;
  comparison?: VersionComparison;
}) => {
  let toc: HTMLElement | undefined;

  const chapters = () =>
    props.text.body.filter((node) => node.tag === "chapter");

  const loose = () =>
    chapters().length === 0
      ? cellsOf(
          props.text.body.flatMap(articles),
          props.text.anchors,
          props.comparison
        )
      : [];

  onSettled(() => toc && followReading(toc));

  const targets = () =>
    cellsOf(
      props.text.body.flatMap(articles),
      props.text.anchors,
      props.comparison
    );

  return (
    <nav
      id="daftar-isi"
      aria-label="Daftar isi"
      ref={(element: HTMLElement) => {
        toc = element;
      }}
    >
      <div class={css(styles.head)}>
        <h2 class={css(styles.title)}>Daftar isi</h2>
        <span class={css(styles.folds)}>
          <button
            type="button"
            class={css(styles.foldButton)}
            onClick={() => {
              setAllFolds(false);
            }}
          >
            Tutup semua
          </button>
          <button
            type="button"
            class={css(styles.foldButton)}
            onClick={() => {
              setAllFolds(true);
            }}
          >
            Buka semua
          </button>
        </span>
      </div>
      <Show when={Object.keys(props.text.anchors).length > 0}>
        <PasalJump targets={targets()} />
      </Show>
      <ol class={css(styles.list)}>
        <For each={chapters()}>
          {(chapter) => (
            <Chapter
              chapter={chapter}
              anchors={props.text.anchors}
              comparison={props.comparison}
            />
          )}
        </For>
        <Show when={loose().length > 0}>
          <li>
            <PasalGrid cells={loose()} label="Pasal" />
          </li>
        </Show>
        <Show when={props.text.penjelasan.length > 0}>
          <li class={css(styles.penjelasan)}>
            <a
              href="#penjelasan"
              target="_self"
              class={css(linkStyles.base, styles.chapterLink)}
            >
              <span class={css(styles.label)}>Penjelasan</span>
            </a>
          </li>
        </Show>
      </ol>
    </nav>
  );
};
