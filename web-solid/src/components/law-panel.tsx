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
import { linkClass, linkStyles } from "../styles/link.ts";
import { versionLink } from "../styles/markers.stylex.ts";
import { panel, versions } from "../styles/panel.ts";
import { color, size, space } from "../styles/tokens.stylex.ts";

const styles = stylex.create({
  facts: { marginBlockEnd: space.s6 },
  factList: { margin: 0 },
  term: { color: color.textMuted, fontSize: size.xs },
  definition: { margin: 0, overflowWrap: "anywhere" },
  fact: { marginBlockEnd: space.s3 },
  title: { marginBlockEnd: space.s3 },
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
      <span class={css(versions.when)}>
        {whenLabel(props.row.date, missing())}
      </span>
      <span
        class={css(
          versions.what,
          props.row.here && versions.whatHere,
          missing() && versions.whatMissing
        )}
      >
        {props.row.label}
        {props.row.inForce && (
          <span class={css(versions.state)}> · berlaku</span>
        )}
      </span>
      <Show when={props.row.sub}>
        {(sub) => (
          <span class={css(versions.sub)}>
            {sub()}
            {props.row.made && " · dibuat oleh UU ini"}
          </span>
        )}
      </Show>
    </>
  );

  return (
    <li>
      {isPresent(props.row.href) && !props.row.here ? (
        <a
          class={css(linkStyles.base, versions.entry, versionLink)}
          href={props.row.href}
        >
          {body()}
        </a>
      ) : (
        <span
          class={css(versions.entry, props.row.here && versions.entryHere)}
          aria-current={props.row.here ? "page" : undefined}
        >
          {body()}
        </span>
      )}
    </li>
  );
};

/** Every version of the law's family, oldest first (decision 0010). */
export const Versions = (props: { family: Family }) => (
  <Collapsible defaultOpen class={css(panel.block)}>
    <CollapsibleTrigger class={css(versions.trigger)}>
      <span class={css(panel.title)}>Versi</span>
      <span class={css(versions.count)}>
        {props.family.versions.filter((row) => row.kind === "point").length}
      </span>
    </CollapsibleTrigger>
    <CollapsiblePanel>
      <ol class={css(panel.list)}>
        <For each={props.family.versions}>{(row) => <Version row={row} />}</For>
      </ol>
      <Show when={props.family.comparable}>
        <a class={css(linkStyles.base, versions.compare)} href="?bandingkan">
          Bandingkan versi
        </a>
      </Show>
      <p class={css(panel.note, versions.noteIndent)}>
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
