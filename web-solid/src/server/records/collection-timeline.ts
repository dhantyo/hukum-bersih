import * as v from "valibot";

import { internalLink, lawAnchorLink } from "../../lib/schemas.ts";
import { readActiveReleaseText } from "../corpus.ts";
import { parseRecord } from "./parse.ts";

const status = v.object({ key: v.string(), label: v.string() });

const missingEvent = v.object({
  kind: v.literal("tidak-tersedia"),
  dotted: v.boolean(),
  what: v.string(),
  id: v.optional(v.string()),
  why: v.string(),
});

const lawEvent = v.object({
  kind: v.picklist([
    "pendahulu",
    "pokok",
    "perubahan",
    "dicabut",
    "ditetapkan-dari",
  ]),
  dotted: v.boolean(),
  date: v.nullable(v.string()),
  role: v.string(),
  law: v.object({ label: v.string(), href: v.optional(internalLink) }),
  subject: v.optional(v.string()),
  noText: v.boolean(),
  status: v.optional(status),
  changes: v.array(
    v.object({
      key: v.picklist(["diubah", "disisipkan", "dihapus"]),
      label: v.string(),
      items: v.array(
        v.object({ num: v.string(), href: v.optional(lawAnchorLink) })
      ),
    })
  ),
  compareHref: v.optional(lawAnchorLink),
});

const timeline = v.object({
  count: v.number(),
  amended: v.number(),
  status: v.nullable(status),
  base: v.object({ label: v.string(), href: internalLink }),
  detailed: v.boolean(),
  events: v.array(v.union([missingEvent, lawEvent])),
});

export type CollectionTimeline = v.InferOutput<typeof timeline>;

export type TimelineEvent = CollectionTimeline["events"][number];

export const readCollectionTimeline = async (slug: string) => {
  const text = await readActiveReleaseText(`collections/${slug}/timeline.json`);

  return text === null
    ? null
    : parseRecord(timeline, text, `collection timeline ${slug}`);
};
