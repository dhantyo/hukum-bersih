import * as stylex from "@stylexjs/stylex";
import { For } from "solid-js";

import type { CollectionComparisonView } from "../lib/collections.ts";
import { tanggal } from "../lib/labels.ts";
import { isPresent } from "../lib/text.ts";
import type {
  CollectionTimeline,
  TimelineEvent,
} from "../server/records/collection-timeline.ts";
import { collapse } from "../styles/collapse.ts";
import { css } from "../styles/css.ts";
import { linkClass, linkStyles } from "../styles/link.ts";
import { fold } from "../styles/markers.stylex.ts";
import { color, size, space } from "../styles/tokens.stylex.ts";
import { Badge } from "./badge.tsx";
import { CollectionCompare } from "./collection-compare.tsx";
import {
  EventBody,
  EventNote,
  EventTime,
  EventTitle,
  HistoryEvent,
  HistoryTimeline,
} from "./history-timeline.tsx";
import type { EventTone } from "./history-timeline.tsx";

type LawEvent = Extract<TimelineEvent, { date: string | null }>;

const CLOSED = ":not([open])";

const styles = stylex.create({
  eyebrow: {
    margin: `${space.s4} 0 0`,
    color: color.link,
    fontSize: size.xs,
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  name: { marginBlock: `${space.s1} 0` },
  subtitle: {
    margin: `${space.s1} 0 0`,
    color: color.textMuted,
    fontSize: size.lg,
  },
  meta: {
    margin: `${space.s3} 0 0`,
    gap: `${space.s2} ${space.s4}`,
    alignItems: "center",
    color: color.textMuted,
    display: "flex",
    flexWrap: "wrap",
    fontSize: size.sm,
  },
  section: { margin: `${space.s6} 0 ${space.s2}` },
  links: { fontSize: size.sm, marginBlockStart: space.s3 },
  role: {
    margin: `${space.s1} 0 0`,
    color: {
      default: color.textMuted,
      ":is([data-kind=pokok])": color.link,
    },
    fontSize: size.xs,
    fontWeight: 600,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  },
  what: {
    margin: `${space.s1} 0 0`,
    gap: `${space.s1} ${space.s3}`,
    alignItems: "baseline",
    display: "flex",
    flexWrap: "wrap",
  },
  whatMissing: { color: color.textMuted },
  law: { fontWeight: 600 },
  subject: { color: color.textMuted, fontSize: size.sm },
  sub: {
    margin: `${space.s1} 0 0`,
    color: color.textMuted,
    fontSize: size.sm,
  },
  box: {
    borderColor: color.line,
    borderRadius: size.radiusMd,
    borderStyle: "solid",
    borderWidth: 1,
    backgroundColor: color.backgroundSubtle,
    marginBlockStart: space.s2,
  },
  trigger: {
    borderRadius: size.radiusMd,
    borderWidth: 0,
    gap: `${space.s2} ${space.s4}`,
    listStyle: "none",
    paddingBlock: space.s2,
    paddingInline: space.s3,
    alignItems: "center",
    backgroundColor: "transparent",
    boxSizing: "border-box",
    color: color.text,
    cursor: "pointer",
    display: "flex",
    flexWrap: "wrap",
    fontFamily: "inherit",
    fontSize: size.sm,
    inlineSize: "100%",
    justifyContent: "space-between",
    outlineColor: color.link,
    outlineOffset: { default: null, ":focus-visible": -3 },
    outlineStyle: { default: null, ":focus-visible": "solid" },
    outlineWidth: { default: null, ":focus-visible": 3 },
    textAlign: "start",
  },
  counts: { gap: `${space.s1} ${space.s4}`, display: "flex", flexWrap: "wrap" },
  count: { fontVariantNumeric: "tabular-nums" },
  countDiubah: { color: color.warn },
  countDisisipkan: { color: color.ok },
  countDihapus: { color: color.delText },
  more: {
    color: color.link,
    fontWeight: 600,
    whiteSpace: "nowrap",
    "::after": {
      content: '"▴"',
      display: "inline-block",
      marginInlineStart: "0.35em",
      transform: {
        default: null,
        [stylex.when.ancestor(CLOSED, fold)]: "rotate(180deg)",
      },
    },
  },
  groups: {
    paddingBlock: `${space.s1} ${space.s3}`,
    paddingInline: space.s3,
    backgroundColor: color.background,
    borderBlockStartColor: color.line,
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: 1,
    borderEndEndRadius: size.radiusMd,
    borderEndStartRadius: size.radiusMd,
  },
  group: {
    margin: `${space.s3} 0 ${space.s2}`,
    color: color.textMuted,
    fontSize: size.xs,
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  chips: {
    margin: 0,
    padding: 0,
    gap: space.s1,
    listStyle: "none",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(3.25rem, 1fr))",
  },
  chip: {
    borderColor: {
      default: color.line,
      ":hover": color.link,
    },
    borderRadius: size.radius,
    borderStyle: "solid",
    borderWidth: 1,
    paddingBlock: space.hairline,
    textDecoration: "none",
    backgroundColor: { default: null, ":hover": color.linkBackground },
    color: { default: color.text, ":hover": color.link },
    display: "block",
    fontSize: size.sm,
    fontVariantNumeric: "tabular-nums",
    textAlign: "center",
  },
  chipDisisipkan: { borderStyle: "dashed" },
  chipDihapus: { textDecoration: "line-through", color: color.textMuted },
  go: {
    display: "inline-block",
    fontSize: size.sm,
    fontWeight: 600,
    marginBlockStart: space.s3,
  },
});

const markerTone = {
  pendahulu: "gone",
  pokok: "filled",
  perubahan: "warn",
  dicabut: "goneFilled",
  "ditetapkan-dari": "default",
} as const satisfies Record<LawEvent["kind"], EventTone>;

const countStyle = {
  diubah: styles.countDiubah,
  disisipkan: styles.countDisisipkan,
  dihapus: styles.countDihapus,
} as const;

const chipStyle = {
  diubah: null,
  disisipkan: styles.chipDisisipkan,
  dihapus: styles.chipDihapus,
} as const;

const ChangedArticles = (props: { event: LawEvent }) => (
  <details class={css(styles.box, fold)}>
    <summary class={css(styles.trigger)}>
      <span class={css(styles.counts)}>
        <For each={props.event.changes}>
          {(group) => (
            <span class={css(styles.count)}>
              <b class={css(countStyle[group.key])}>{group.items.length}</b>{" "}
              {group.label.toLowerCase()}
            </span>
          )}
        </For>
      </span>
      <span class={css(styles.more, collapse.triggerArrow)}>Daftar pasal</span>
    </summary>
    <div class={css(styles.groups)}>
      <For each={props.event.changes}>
        {(group) => (
          <section>
            <h3 class={css(styles.group)}>{group.label}</h3>
            <ul class={css(styles.chips)}>
              <For each={group.items}>
                {(item) => (
                  <li>
                    {isPresent(item.href) ? (
                      <a
                        class={css(
                          linkStyles.base,
                          styles.chip,
                          chipStyle[group.key]
                        )}
                        href={item.href}
                      >
                        {item.num}
                      </a>
                    ) : (
                      <span class={css(styles.chip, chipStyle[group.key])}>
                        {item.num}
                      </span>
                    )}
                  </li>
                )}
              </For>
            </ul>
          </section>
        )}
      </For>
      {isPresent(props.event.compareHref) && (
        <a
          class={css(linkStyles.base, styles.go)}
          href={props.event.compareHref}
        >
          Sebelum dan sesudah, pasal demi pasal →
        </a>
      )}
    </div>
  </details>
);

const LawEntry = (props: { event: LawEvent }) => (
  <HistoryEvent tone={markerTone[props.event.kind]} dotted={props.event.dotted}>
    <EventTime datetime={props.event.date ?? undefined}>
      {isPresent(props.event.date)
        ? tanggal(props.event.date)
        : "tanggal tidak diketahui"}
    </EventTime>
    <EventTitle>
      <p class={css(styles.role)} data-kind={props.event.kind}>
        {props.event.role}
      </p>
      <p class={css(styles.what)}>
        <span class={css(styles.law)}>
          {isPresent(props.event.law.href) ? (
            <a class={linkClass} href={props.event.law.href}>
              {props.event.law.label}
            </a>
          ) : (
            props.event.law.label
          )}
        </span>
        {isPresent(props.event.subject) && (
          <span class={css(styles.subject)}>{props.event.subject}</span>
        )}
        {props.event.noText && <Badge tone="none">teks belum ada</Badge>}
        {props.event.status !== undefined && (
          <Badge tone={props.event.status.key}>
            {props.event.status.label}
          </Badge>
        )}
      </p>
    </EventTitle>
    {props.event.kind === "perubahan" && props.event.changes.length > 0 && (
      <EventBody>
        <ChangedArticles event={props.event} />
      </EventBody>
    )}
    {props.event.kind === "perubahan" && props.event.changes.length === 0 && (
      <EventNote>
        <p class={css(styles.sub)}>
          Pasal yang diubah belum dapat dibaca dari teksnya.
        </p>
      </EventNote>
    )}
  </HistoryEvent>
);

const MissingEntry = (props: {
  event: Extract<TimelineEvent, { kind: "tidak-tersedia" }>;
}) => (
  <HistoryEvent tone="missing" dotted={props.event.dotted}>
    <EventTitle>
      <p class={css(styles.role)}>{props.event.what}</p>
      <p class={css(styles.what, styles.whatMissing)}>
        {isPresent(props.event.id) ? `${props.event.id}: ` : ""}belum tersedia
        di sini
      </p>
    </EventTitle>
    <EventNote>
      <p class={css(styles.sub)}>{props.event.why}</p>
    </EventNote>
  </HistoryEvent>
);

const TimelineList = (props: { events: CollectionTimeline["events"] }) => (
  <HistoryTimeline label="Riwayat koleksi">
    <For each={props.events}>
      {(event) =>
        event.kind === "tidak-tersedia" ? (
          <MissingEntry event={event} />
        ) : (
          <LawEntry event={event} />
        )
      }
    </For>
  </HistoryTimeline>
);

/** A collection without merged text: its laws over time, the versions we lack marked. */
export const CollectionHistory = (props: {
  name: string;
  subtitle?: string;
  timeline: CollectionTimeline;
  comparison: CollectionComparisonView | null;
}) => (
  <>
    <p class={css(styles.eyebrow)}>Koleksi</p>
    <h1 class={css(styles.name)}>{props.name}</h1>
    {isPresent(props.subtitle) && (
      <p class={css(styles.subtitle)}>{props.subtitle}</p>
    )}
    <div class={css(styles.meta)}>
      <span>{props.timeline.count} undang-undang</span>
      {props.timeline.amended > 0 && (
        <Badge tone="diubah">diubah {props.timeline.amended}×</Badge>
      )}
      {props.timeline.status !== null && (
        <Badge tone={props.timeline.status.key}>
          {props.timeline.status.label}
        </Badge>
      )}
    </div>
    <h2 class={css(styles.section)} id="riwayat">
      Riwayat
    </h2>
    <TimelineList events={props.timeline.events} />
    <p class={css(styles.links)}>
      <a class={linkClass} href={props.timeline.base.href}>
        Baca teks {props.timeline.base.label}
      </a>
      {props.timeline.detailed && (
        <>
          {" · "}
          <a class={linkClass} href={`${props.timeline.base.href}?v=`}>
            Rincian tiap perubahan, pasal demi pasal
          </a>
        </>
      )}
    </p>
    {props.comparison === null ? (
      props.timeline.amended > 0 && (
        <p class={css(styles.sub)}>
          Perubahan-perubahan di koleksi ini belum dapat dibandingkan pasal demi
          pasal (teksnya belum terbaca).
        </p>
      )
    ) : (
      <CollectionCompare comparison={props.comparison} />
    )}
  </>
);
