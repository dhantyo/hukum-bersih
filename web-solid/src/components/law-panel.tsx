import type { JSX } from "@solidjs/web";
import * as stylex from "@stylexjs/stylex";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@ui-sdk/solid/collapsible";
import { For, Show } from "solid-js";

import { tanggal } from "../lib/labels.ts";
import { isPresent } from "../lib/text.ts";
import type { Family } from "../server/records/law.ts";
import { css } from "../styles/css.ts";
import { versionHead, versionLink, versionRow } from "../styles/fold.stylex.ts";
import { linkClass, linkStyles } from "../styles/link.ts";
import { panel } from "../styles/panel.ts";
import { color, size, space } from "../styles/tokens.stylex.ts";

const OPEN = ":is([data-open])";
const HERE = ":is([data-here])";

const styles = stylex.create({
  versions: { marginBlockEnd: space.s5 },
  summary: {
    font: "inherit",
    padding: 0,
    borderRadius: size.radius,
    borderWidth: 0,
    gap: space.s2,
    alignItems: "baseline",
    backgroundColor: "transparent",
    color: "inherit",
    cursor: "pointer",
    display: "flex",
    inlineSize: "100%",
    marginBlockEnd: space.s2,
    outlineColor: color.link,
    outlineOffset: { default: null, ":focus-visible": 2 },
    outlineStyle: { default: null, ":focus-visible": "solid" },
    outlineWidth: { default: null, ":focus-visible": 3 },
    textAlign: "start",
  },
  title: { marginBlockEnd: 0 },
  chevron: {
    alignSelf: "center",
    blockSize: 6,
    borderBlockEndColor: color.textMuted,
    borderBlockEndStyle: "solid",
    borderBlockEndWidth: 1.6,
    borderInlineEndColor: color.textMuted,
    borderInlineEndStyle: "solid",
    borderInlineEndWidth: 1.6,
    inlineSize: 6,
    marginInlineStart: "auto",
    transform: {
      default: "rotate(45deg)",
      [stylex.when.ancestor(OPEN, versionHead)]: "rotate(-135deg)",
    },
  },
  count: { color: color.textMuted, fontSize: size.xs },
  list: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    position: "relative",
    "::before": {
      insetBlock: space.s2,
      backgroundColor: color.line,
      content: '""',
      inlineSize: 1,
      insetInlineStart: 4,
      position: "absolute",
    },
  },
  row: {
    borderRadius: size.radius,
    paddingBlock: space.s1,
    backgroundColor: {
      [HERE]: color.linkBackground,
      default: null,
    },
    marginInlineStart: {
      [HERE]: `calc(-1 * ${space.s1})`,
      default: null,
    },
    paddingInlineStart: {
      [HERE]: `calc(${space.s5} + ${space.s1})`,
      default: space.s5,
    },
    position: "relative",
  },
  dot: {
    borderRadius: "50%",
    backgroundColor: color.gone,
    blockSize: 9,
    boxShadow: `0 0 0 3px ${color.background}`,
    inlineSize: 9,
    insetInlineStart: {
      default: 0,
      [stylex.when.ancestor(HERE, versionRow)]: space.s1,
    },
    position: "absolute",
    top: `calc(${space.s1} + 0.35em)`,
  },
  dotNow: { backgroundColor: color.ok },
  dotMissing: {
    borderColor: color.gone,
    borderStyle: "dashed",
    borderWidth: 1,
    backgroundColor: color.background,
  },
  entry: {
    borderRadius: size.radius,
    paddingBlock: { default: null, "@media (pointer: coarse)": space.s2 },
    textDecoration: "none",
    color: color.text,
    display: "grid",
  },
  when: {
    color: color.textMuted,
    fontSize: size.xs,
    fontVariantNumeric: "tabular-nums",
  },
  what: {
    textDecoration: {
      default: null,
      [stylex.when.ancestor(":hover", versionLink)]: "underline",
    },
    color: {
      default: null,
      [stylex.when.ancestor(":hover", versionLink)]: color.link,
      [stylex.when.ancestor(HERE, versionRow)]: color.link,
    },
    fontWeight: 600,
  },
  whatMissing: { color: color.textMuted, fontWeight: 400 },
  state: { color: color.ok, fontWeight: 400 },
  sub: { color: color.textMuted, display: "block", fontSize: size.xs },
  note: {
    margin: 0,
    color: color.textMuted,
    fontSize: size.xs,
    marginBlockStart: space.s2,
  },
  compare: {
    borderColor: { default: color.lineStrong, ":hover": color.link },
    borderRadius: size.radius,
    borderStyle: "solid",
    borderWidth: 1,
    paddingBlock: space.s1,
    paddingInline: space.s3,
    textDecoration: "none",
    backgroundColor: {
      default: color.background,
      ":hover": color.linkBackground,
    },
    boxSizing: "border-box",
    display: "block",
    fontWeight: 600,
    marginBlockStart: space.s2,
    minBlockSize: space.s6,
    textAlign: "center",
  },
  facts: { marginBlockEnd: space.s6 },
  factList: { margin: 0 },
  term: {
    color: color.textMuted,
    fontSize: size.xs,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  definition: { margin: 0, overflowWrap: "anywhere" },
  fact: {
    paddingBlock: space.s2,
    borderBlockEndColor: color.line,
    borderBlockEndStyle: "solid",
    borderBlockEndWidth: 1,
    borderBlockStartColor: color.line,
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: { default: 0, ":first-child": 1 },
  },
});

const whenLabel = (date: string | null, missing: boolean) => {
  if (isPresent(date)) {
    return tanggal(date);
  }

  return missing ? "—" : "tanggal tidak diketahui";
};

const Version = (props: { row: Family["versions"][number] }) => {
  const missing = () => props.row.kind === "missing";

  const body = () => (
    <>
      <span class={css(styles.when)}>
        {whenLabel(props.row.date, missing())}
      </span>
      <span class={css(styles.what, missing() && styles.whatMissing)}>
        {props.row.label}
        {props.row.inForce && <span class={css(styles.state)}> · berlaku</span>}
      </span>
    </>
  );

  return (
    <li
      class={css(styles.row, versionRow)}
      data-here={props.row.here ? "" : undefined}
    >
      <span
        class={css(
          styles.dot,
          props.row.inForce && styles.dotNow,
          missing() && styles.dotMissing
        )}
        aria-hidden="true"
      />
      {isPresent(props.row.href) && !props.row.here ? (
        <a
          class={css(linkStyles.base, styles.entry, versionLink)}
          href={props.row.href}
        >
          {body()}
        </a>
      ) : (
        <span
          class={css(styles.entry)}
          aria-current={props.row.here ? "page" : undefined}
        >
          {body()}
        </span>
      )}
      <Show when={props.row.sub}>
        {(sub) => (
          <span class={css(styles.sub)}>
            {sub()}
            {props.row.made && " · dibuat oleh UU ini"}
          </span>
        )}
      </Show>
    </li>
  );
};

/** Every version of the law's family, oldest first (decision 0010). */
export const Versions = (props: { family: Family }) => (
  <Collapsible defaultOpen class={css(styles.versions)}>
    <CollapsibleTrigger class={css(styles.summary, versionHead)}>
      <span class={css(panel.title, styles.title)}>Versi</span>
      <span class={css(styles.count)}>
        {props.family.versions.filter((row) => row.kind === "point").length}
      </span>
      <span class={css(styles.chevron)} aria-hidden="true" />
    </CollapsibleTrigger>
    <CollapsiblePanel>
      <ol class={css(styles.list)}>
        <For each={props.family.versions}>{(row) => <Version row={row} />}</For>
      </ol>
      <Show when={props.family.comparable}>
        <a class={css(linkStyles.base, styles.compare)} href="?bandingkan">
          Bandingkan versi
        </a>
      </Show>
      <p class={css(styles.note)}>
        Versi gabungan disusun otomatis dari teks asli dan undang-undang
        perubahannya; bukan teks konsolidasi resmi.
      </p>
    </CollapsiblePanel>
  </Collapsible>
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
    <h2 class={css(panel.title)}>{props.title}</h2>
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
