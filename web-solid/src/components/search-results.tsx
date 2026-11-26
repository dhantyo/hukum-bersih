import { useNavigate } from "@solidjs/router";
import * as stylex from "@stylexjs/stylex";
import { createSignal, For, Show } from "solid-js";
import type { ParentProps } from "solid-js";

import { plainSearchUrl, searchUrl } from "../lib/search-form.ts";
import type {
  SearchArticle,
  SearchCollection,
  SearchLaw,
} from "../lib/search-matches.ts";
import { css } from "../styles/css.ts";
import { linkStyles } from "../styles/link.ts";
import { color, size, space } from "../styles/tokens.stylex.ts";
import { Badge } from "./badge.tsx";

const FIRST_LAWS = 8;
const MORE_LAWS = 20;

const EXAMPLES = [
  "minerba",
  "4/2009",
  "perseroan terbatas",
  "pencemaran nama baik",
];

const NO_SCRIPT = "@media (scripting: none)";

export const searchStyles = stylex.create({
  results: { maxInlineSize: "52rem" },
  group: { marginBlockStart: space.s6 },
  heading: {
    margin: `0 0 ${space.s2}`,
    borderBlockEndColor: color.line,
    borderBlockEndStyle: "solid",
    borderBlockEndWidth: 1,
    color: color.textMuted,
    fontSize: size.xs,
    fontWeight: 600,
    letterSpacing: "0.06em",
    paddingBlockEnd: space.s2,
    textTransform: "uppercase",
  },
  list: { margin: 0, padding: 0, listStyle: "none" },
  item: {
    paddingBlock: space.s3,
    borderBlockEndColor: color.line,
    borderBlockEndStyle: "solid",
    borderBlockEndWidth: 1,
  },
  name: { fontSize: size.base, fontWeight: 600 },
  nameLarge: { fontSize: size.lg },
  meta: {
    gap: `${space.s1} ${space.s3}`,
    alignItems: "center",
    color: color.textMuted,
    display: "flex",
    flexWrap: "wrap",
    fontSize: size.sm,
    marginBlockStart: space.s1,
  },
  tag: {
    color: color.link,
    fontSize: size.xs,
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  children: {
    margin: 0,
    listStyle: "none",
    paddingBlock: 0,
    borderInlineStartColor: color.line,
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: 2,
    fontSize: size.sm,
    marginBlockStart: space.s2,
    paddingInlineEnd: 0,
    paddingInlineStart: space.s4,
  },
  child: { paddingBlock: space.hairline },
  role: {
    color: color.textMuted,
    display: "inline-block",
    fontSize: size.xs,
    letterSpacing: "0.04em",
    minInlineSize: "8.5rem",
    textTransform: "uppercase",
  },
  muted: { color: color.textMuted },
  more: {
    font: "inherit",
    borderColor: color.lineStrong,
    borderRadius: size.radius,
    borderStyle: "solid",
    borderWidth: 1,
    paddingBlock: space.s1,
    paddingInline: space.s3,
    backgroundColor: "transparent",
    color: color.link,
    cursor: "pointer",
    display: { [NO_SCRIPT]: "none", default: null },
    fontSize: size.sm,
    marginBlockStart: space.s3,
    minBlockSize: size.tap,
    outlineColor: color.link,
    outlineOffset: { default: null, ":focus-visible": 2 },
    outlineStyle: { default: null, ":focus-visible": "solid" },
    outlineWidth: { default: null, ":focus-visible": 3 },
  },
  hint: {
    color: color.textMuted,
    fontSize: size.sm,
    marginBlockStart: space.s2,
  },
});

export const SearchGroup = (props: ParentProps<{ title: string }>) => (
  <section class={css(searchStyles.group)}>
    <h2 class={css(searchStyles.heading)}>{props.title}</h2>
    {props.children}
  </section>
);

export const SearchMore = (props: { onClick: () => void }) => (
  <button
    class={css(searchStyles.more)}
    type="button"
    onClick={() => {
      props.onClick();
    }}
  >
    Tampilkan lebih banyak
  </button>
);

const LawBadges = (props: { status: SearchLaw["status"]; changed: number }) => (
  <>
    <Show when={props.status} keyed>
      {(status) => <Badge tone={status.key}>{status.label}</Badge>}
    </Show>
    <Show when={props.changed > 0}>
      <Badge tone="diubah">diubah {props.changed}×</Badge>
    </Show>
  </>
);

const LawItem = (props: { law: SearchLaw; href?: string; name?: string }) => (
  <li class={css(searchStyles.item)}>
    <a
      class={css(searchStyles.name, linkStyles.base)}
      href={props.href ?? props.law.url}
    >
      {props.name ?? props.law.name}
    </a>
    <div class={css(searchStyles.meta)}>
      <span>{props.law.cite}</span>
      <Show when={props.law.title} keyed>
        {(title) => <span>{title}</span>}
      </Show>
      <LawBadges status={props.law.status} changed={props.law.changed} />
    </div>
  </li>
);

export const ArticleResults = (props: { articles: SearchArticle[] }) => (
  <SearchGroup title="Pasal">
    <ul class={css(searchStyles.list)}>
      <For each={props.articles}>
        {(article) => (
          <LawItem law={article.law} href={article.url} name={article.label} />
        )}
      </For>
    </ul>
  </SearchGroup>
);

const CollectionItem = (props: { collection: SearchCollection }) => (
  <li class={css(searchStyles.item)}>
    <a
      class={css(searchStyles.name, searchStyles.nameLarge, linkStyles.base)}
      href={props.collection.url}
    >
      {props.collection.name}
    </a>
    <div class={css(searchStyles.meta)}>
      <span class={css(searchStyles.tag)}>Koleksi</span>
      <Show when={props.collection.subject} keyed>
        {(subject) => <span>{subject}</span>}
      </Show>
      <span>{props.collection.count} undang-undang</span>
      <Show when={props.collection.changed > 0}>
        <Badge tone="diubah">diubah {props.collection.changed}×</Badge>
      </Show>
    </div>
    <ul class={css(searchStyles.children)}>
      <For each={props.collection.members}>
        {(member) => (
          <li class={css(searchStyles.child)}>
            <span class={css(searchStyles.role)}>{member.role}</span>{" "}
            <Show when={member.url} fallback={member.cite} keyed>
              {(url) => (
                <a class={css(linkStyles.base)} href={url}>
                  {member.cite}
                </a>
              )}
            </Show>
            <Show when={member.title} keyed>
              {(title) => <span class={css(searchStyles.muted)}> {title}</span>}
            </Show>
          </li>
        )}
      </For>
    </ul>
  </li>
);

export const CollectionResults = (props: {
  collections: SearchCollection[];
}) => (
  <SearchGroup title="Koleksi">
    <ul class={css(searchStyles.list)}>
      <For each={props.collections}>
        {(collection) => <CollectionItem collection={collection} />}
      </For>
    </ul>
  </SearchGroup>
);

export const LawResults = (props: { laws: SearchLaw[] }) => {
  const [shown, setShown] = createSignal(FIRST_LAWS);

  return (
    <SearchGroup title="Nomor dan judul">
      <ul class={css(searchStyles.list)}>
        <For each={props.laws.slice(0, shown())}>
          {(law) => <LawItem law={law} />}
        </For>
      </ul>
      <Show when={props.laws.length > shown()}>
        <SearchMore
          onClick={() => {
            setShown((count) => count + MORE_LAWS);
          }}
        />
      </Show>
    </SearchGroup>
  );
};

export const SearchExamples = () => {
  const navigate = useNavigate();

  return (
    <p class={css(searchStyles.hint)}>
      Contoh:{" "}
      <For each={EXAMPLES}>
        {(example, index) => (
          <>
            <Show when={index() > 0}>{", "}</Show>
            <a
              class={css(linkStyles.base)}
              href={plainSearchUrl(example)}
              onClick={(event) => {
                event.preventDefault();
                navigate(searchUrl(example));
              }}
            >
              {example}
            </a>
          </>
        )}
      </For>
    </p>
  );
};
