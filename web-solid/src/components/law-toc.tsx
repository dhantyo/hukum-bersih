import * as stylex from "@stylexjs/stylex";
import { createSignal, For, onSettled, Show } from "solid-js";
import * as v from "valibot";

import { modernHeading, pasalKey } from "../../../web/src/lib/display.ts";
import type { AknNode } from "../../../web/src/lib/lawdoc.ts";
import { searchText } from "../lib/schemas.ts";
import { isPresent } from "../lib/text.ts";
import type { Mark, VersionComparison } from "../server/law-comparison.ts";
import type { ReaderText } from "../server/records/reader-text.ts";
import { css } from "../styles/css.ts";
import {
  color,
  reader,
  size,
  space,
  synopsis,
} from "../styles/tokens.stylex.ts";
import { MarkIcon } from "./law-compare.tsx";

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
  jump: {
    gap: `${space.s1} ${space.s2}`,
    alignItems: "center",
    color: color.textMuted,
    display: "flex",
    flexWrap: "wrap",
    fontSize: size.xs,
    marginBlockEnd: space.s3,
  },
  input: {
    font: "inherit",
    borderColor: color.lineStrong,
    borderRadius: size.radius,
    borderStyle: "solid",
    borderWidth: 1,
    paddingBlock: space.s1,
    paddingInline: space.s2,
    backgroundColor: color.background,
    color: color.text,
    fontSize: size.sm,
    inlineSize: "5rem",
  },
  message: { color: color.warn, flexBasis: "100%" },
  list: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    borderInlineStartColor: color.line,
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: 1,
  },
  chapterLink: {
    paddingBlock: space.s1,
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
    marginBlockStart: synopsis.hairline,
  },
  count: {
    gap: synopsis.hairline,
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
      [current]: reader.accent,
      default: null,
      ":is([data-mk=del])": synopsis.delBackground,
      ":is([data-mk=ins])": synopsis.insBackground,
      ":is([data-mk=mod])": reader.modBg,
    },
    color: {
      [current]: color.link,
      default: color.text,
      ":is([data-mk=del])": synopsis.delText,
      ":is([data-mk=ins])": synopsis.insText,
      ":is([data-mk=mod])": reader.modText,
    },
    display: "grid",
    fontSize: size.xs,
    fontVariantNumeric: "tabular-nums",
    fontWeight: { [current]: 600, default: null, ":is([data-mk])": 600 },
    minBlockSize: space.s6,
    minInlineSize: "2.25rem",
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
            class={css(styles.cell)}
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
      <details open={changes().length > 0}>
        <summary class={css(styles.summary)}>
          <a
            href={`#${props.chapter.eId}`}
            target="_self"
            class={css(styles.chapterLink)}
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

const followReading = (toc: HTMLElement) => {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue;
        }

        const link = toc.querySelector<HTMLElement>(
          `[data-ch-link="${CSS.escape(entry.target.id)}"], [data-pasal="${CSS.escape(entry.target.id)}"]`
        );

        if (link === null) {
          continue;
        }

        for (const old of toc.querySelectorAll<HTMLElement>("[aria-current]")) {
          if (
            Object.hasOwn(old.dataset, "chLink") ===
            Object.hasOwn(link.dataset, "chLink")
          ) {
            old.removeAttribute("aria-current");
          }
        }

        link.setAttribute("aria-current", "true");
        link.closest("details")?.setAttribute("open", "");
      }
    },
    { rootMargin: "0px 0px -70% 0px" }
  );

  for (const link of toc.querySelectorAll<HTMLElement>(
    "[data-ch-link], [data-pasal]"
  )) {
    const target = document.querySelector(
      `#${CSS.escape(link.dataset.chLink ?? link.dataset.pasal ?? "")}`
    );

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

  const [missing, setMissing] = createSignal("");

  onSettled(() => toc && followReading(toc));

  const jump = (event: SubmitEvent & { currentTarget: HTMLFormElement }) => {
    event.preventDefault();

    const typed = v.parse(
      searchText,
      new FormData(event.currentTarget).get("pasal")
    );

    const key = typed
      .toLowerCase()
      .replace(/^pasal\s*/u, "")
      .replaceAll(/[^0-9a-z]+/gu, "");

    if (key === "") {
      return;
    }

    if (document.querySelector(`#pasal-${key}`) === null) {
      setMissing(`Pasal ${typed} tidak ada`);

      return;
    }

    setMissing("");
    location.hash = `pasal-${key}`;
  };

  return (
    <nav
      id="daftar-isi"
      aria-label="Daftar isi"
      data-pagefind-ignore
      ref={(element: HTMLElement) => {
        toc = element;
      }}
    >
      <div class={css(styles.head)}>
        <h2 class={css(styles.title)}>Daftar isi</h2>
      </div>
      <Show when={Object.keys(props.text.anchors).length > 0}>
        <form class={css(styles.jump)} onSubmit={jump}>
          <label for="toc-jump-input">Ke pasal</label>
          <input
            id="toc-jump-input"
            name="pasal"
            type="text"
            autocomplete="off"
            placeholder="mis. 27"
            size="5"
            class={css(styles.input)}
          />
          <output class={css(styles.message)}>{missing()}</output>
        </form>
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
              class={css(styles.chapterLink)}
            >
              <span class={css(styles.label)}>Penjelasan</span>
            </a>
          </li>
        </Show>
      </ol>
    </nav>
  );
};
