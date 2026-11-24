import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@ui-sdk/solid/collapsible";
import { For } from "solid-js";

import { tanggal } from "../../../web/src/lib/labels.ts";
import type { CollectionComparisonView } from "../lib/collections.ts";
import { isPresent } from "../lib/text.ts";
import type {
  CollectionTimeline,
  TimelineEvent,
} from "../server/records/collection-timeline.ts";
import { CollectionCompare } from "./collection-compare.tsx";

type LawEvent = Extract<TimelineEvent, { date: string | null }>;

const ChangedArticles = (props: { event: LawEvent }) => (
  <Collapsible defaultOpen>
    <CollapsibleTrigger>
      <For each={props.event.changes}>
        {(group) => (
          <span>
            <b>{group.items.length}</b> {group.label.toLowerCase()}{" "}
          </span>
        )}
      </For>
      <span>Daftar pasal</span>
    </CollapsibleTrigger>
    <CollapsiblePanel>
      <For each={props.event.changes}>
        {(group) => (
          <section>
            <h3>{group.label}</h3>
            <ul>
              <For each={group.items}>
                {(item) => (
                  <li>
                    {isPresent(item.href) ? (
                      <a href={item.href}>{item.num}</a>
                    ) : (
                      item.num
                    )}
                  </li>
                )}
              </For>
            </ul>
          </section>
        )}
      </For>
      {isPresent(props.event.compareHref) && (
        <a href={props.event.compareHref}>
          Sebelum dan sesudah, pasal demi pasal →
        </a>
      )}
    </CollapsiblePanel>
  </Collapsible>
);

const LawEntry = (props: { event: LawEvent }) => (
  <li data-kind={props.event.kind} data-dotted={props.event.dotted}>
    <time>
      {isPresent(props.event.date)
        ? tanggal(props.event.date)
        : "tanggal tidak diketahui"}
    </time>
    <p>{props.event.role}</p>
    <p>
      {isPresent(props.event.law.href) ? (
        <a href={props.event.law.href}>{props.event.law.label}</a>
      ) : (
        props.event.law.label
      )}
      {isPresent(props.event.subject) && <span> {props.event.subject}</span>}
      {props.event.noText && <span> teks belum ada</span>}
      {props.event.status !== undefined && (
        <span> {props.event.status.label}</span>
      )}
    </p>
    {props.event.kind === "perubahan" && props.event.changes.length > 0 && (
      <ChangedArticles event={props.event} />
    )}
    {props.event.kind === "perubahan" && props.event.changes.length === 0 && (
      <p>Pasal yang diubah belum dapat dibaca dari teksnya.</p>
    )}
  </li>
);

const TimelineList = (props: { events: CollectionTimeline["events"] }) => (
  <ol>
    <For each={props.events}>
      {(event) =>
        event.kind === "tidak-tersedia" ? (
          <li data-kind="missing" data-dotted={event.dotted}>
            <p>{event.what}</p>
            <p>
              {isPresent(event.id) ? `${event.id}: ` : ""}belum tersedia di sini
            </p>
            <p>{event.why}</p>
          </li>
        ) : (
          <LawEntry event={event} />
        )
      }
    </For>
  </ol>
);

/** A collection without merged text: its laws over time, the versions we lack marked. */
export const CollectionHistory = (props: {
  name: string;
  subtitle?: string;
  timeline: CollectionTimeline;
  comparison: CollectionComparisonView | null;
}) => (
  <>
    <p>Koleksi</p>
    <h1>{props.name}</h1>
    {isPresent(props.subtitle) && <p>{props.subtitle}</p>}
    <p>
      <span>{props.timeline.count} undang-undang</span>
      {props.timeline.amended > 0 && (
        <span> diubah {props.timeline.amended}×</span>
      )}
      {props.timeline.status !== null && (
        <span> {props.timeline.status.label}</span>
      )}
    </p>
    <h2 id="riwayat">Riwayat</h2>
    <TimelineList events={props.timeline.events} />
    <p>
      <a href={props.timeline.base.href}>
        Baca teks {props.timeline.base.label}
      </a>
      {props.timeline.detailed && (
        <>
          {" · "}
          <a href={`${props.timeline.base.href}?bandingkan`}>
            Rincian tiap perubahan, pasal demi pasal
          </a>
        </>
      )}
    </p>
    {props.comparison === null ? (
      props.timeline.amended > 0 && (
        <p>
          Perubahan-perubahan di koleksi ini belum dapat dibandingkan pasal demi
          pasal (teksnya belum terbaca).
        </p>
      )
    ) : (
      <CollectionCompare comparison={props.comparison} />
    )}
  </>
);
