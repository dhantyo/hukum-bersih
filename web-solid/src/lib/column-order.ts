import { createChange, createReorder, definePrimitive } from "@ui-sdk/core";
import type {
  ChangeDetails,
  ReorderDraft,
  ReorderMessage,
  ReorderReason,
} from "@ui-sdk/core";

export interface ColumnOrderOptions {
  /** The keys of the columns, left to right. */
  value?: string[];
  /** What each column is called to a screen reader, by key. */
  labels?: Record<string, string>;
  onValueChange?: (
    value: string[],
    details: ChangeDetails<ReorderReason>
  ) => void;
}

interface ColumnOrderState {
  value: string[];
  moving: ReorderDraft | null;
}

const announce = (message: ReorderMessage) => {
  const place = `urutan ${message.position} dari ${message.total}`;

  if (message.type === "grab") {
    return `${message.label} diangkat, ${place}. Pindahkan dengan tombol panah, jatuhkan dengan Spasi, batalkan dengan Escape.`;
  }

  if (message.type === "move") {
    return `${message.label}, ${place}.`;
  }

  if (message.type === "drop") {
    return `${message.label} dijatuhkan, ${place}.`;
  }

  return `Pemindahan ${message.label} dibatalkan.`;
};

/**
 * The columns of a comparison, in the order they are shown. A reader reorders them by dragging
 * a column's handle or with the keyboard on it (Space picks it up, the arrows move it, Space
 * drops it, Escape puts it back); each step is announced in Indonesian.
 */
export const columnOrder = definePrimitive({
  name: "column-order",
  options: {
    value: "list",
    labels: "value",
    onValueChange: "callback",
  },
  controlled: ["value"],
  state: (options: ColumnOrderOptions) =>
    ({
      value: options.value ?? [],
      moving: null,
    }) satisfies ColumnOrderState,
  sync: (options) =>
    options.value === undefined ? {} : { value: options.value },
  api: (context) => {
    const change = createChange(context);

    const reorder = createReorder(context, {
      slot: "column",
      key: "value",
      draft: "moving",
      orientation: () => "horizontal",
      set: (value, details) => change("value", value, details),
      label: (key) => context.options().labels?.[key],
      message: announce,
    });

    return { reorder };
  },
  slots: (slot) => ({
    root: slot({
      role: "group",
      state: (state, { api }) => ({ order: api.reorder.order(state) }),
    }),
    column: slot<{ value: string }>({
      props: { value: "string" },
      attrs: (state, { api, key }) => ({
        "data-grabbed": api.reorder.moving(state, key) ? "" : undefined,
      }),
      bind: (el, part) => part.api.reorder.bind(el, part),
    }),
    handle: slot<{ value: string }>({
      props: { value: "string" },
      role: "button",
      focus: "native",
      press: { none: "Space and Enter pick the column up in keydown." },
      keys: ["Enter", " ", "ArrowLeft", "ArrowRight", "Home", "End", "Escape"],
      attrs: (state, { api, key }) => ({
        type: "button",
        "aria-pressed": String(api.reorder.moving(state, key)),
        "aria-roledescription": "pengurut kolom",
      }),
      on: {
        keydown: (event, { api, key }) => {
          api.reorder.keydown(event, key);
        },
        pointerdown: (event, { api, key }) => {
          api.reorder.pointerdown(event, key);
        },
      },
    }),
  }),
});
