import * as stylex from "@stylexjs/stylex";
import { For } from "solid-js";

import { stageLabel, tanggal } from "../lib/labels.ts";
import { isPresent } from "../lib/text.ts";
import type { DraftBill } from "../server/records/draft.ts";
import { css } from "../styles/css.ts";
import { color } from "../styles/tokens.stylex.ts";
import {
  EventTime,
  EventTitle,
  HistoryEvent,
  HistoryTimeline,
} from "./history-timeline.tsx";

const styles = stylex.create({
  note: { color: color.textMuted },
});

/** "Perjalanan": the stages of a bill in order, the latest one filled. */
export const DraftStages = (props: { stages: DraftBill["stages"] }) => (
  <HistoryTimeline label="Perjalanan">
    <For each={props.stages}>
      {(stage, index) => (
        <HistoryEvent
          narrow
          tone={index() === props.stages.length - 1 ? "filled" : "default"}
        >
          <EventTime datetime={stage.date}>{tanggal(stage.date)}</EventTime>
          <EventTitle>
            <strong>{stageLabel(stage.stage)}</strong>
            {isPresent(stage.note) && (
              <span class={css(styles.note)}> · {stage.note}</span>
            )}
          </EventTitle>
        </HistoryEvent>
      )}
    </For>
  </HistoryTimeline>
);
