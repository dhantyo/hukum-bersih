import type { JSX } from "@solidjs/web";
import * as stylex from "@stylexjs/stylex";
import { For } from "solid-js";

import { isPresent } from "../lib/text.ts";
import type { Family } from "../server/records/law.ts";
import { css } from "../styles/css.ts";
import { linkClass } from "../styles/link.ts";
import { panel } from "../styles/panel.ts";
import { color, size, space } from "../styles/tokens.stylex.ts";
import { VersionList } from "./version-list.tsx";

const styles = stylex.create({
  facts: { marginBlockEnd: space.s6 },
  factList: { margin: 0 },
  term: { color: color.textMuted, fontSize: size.xs },
  definition: { margin: 0, overflowWrap: "anywhere" },
  fact: { marginBlockEnd: space.s3 },
  title: { marginBlockEnd: space.s3 },
});

/** Every version of the law's family, oldest first (decision 0010). */
export const Versions = (props: { family: Family }) => (
  <VersionList
    items={props.family.versions.map((row) => ({
      ...row,
      missing: row.kind === "missing",
    }))}
    compareHref={props.family.comparable ? "?v=" : undefined}
  />
);

export interface Fact {
  label: string;
  value?: string | null;
  href?: string | null;
}

export const Facts = (props: {
  title: string;
  facts: Fact[];
  children?: JSX.Element;
}) => (
  <section class={css(styles.facts)}>
    <h2 class={css(panel.title, styles.title)}>{props.title}</h2>
    <dl class={css(styles.factList)}>
      <For each={props.facts.filter((fact) => isPresent(fact.value))}>
        {(fact) => (
          <div class={css(styles.fact)}>
            <dt class={css(styles.term)}>{fact.label}</dt>
            <dd class={css(styles.definition)}>
              {isPresent(fact.href) ? (
                <a class={linkClass} href={fact.href}>
                  {fact.value}
                </a>
              ) : (
                fact.value
              )}
            </dd>
          </div>
        )}
      </For>
    </dl>
    {props.children}
  </section>
);
