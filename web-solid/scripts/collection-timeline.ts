import { isPresent } from "../src/lib/text.ts";
import { amendments, display, koleksi, peraturan } from "./astro-data.ts";

type Collection = ReturnType<typeof koleksi.loadKoleksi>[number];

type Document = ReturnType<typeof peraturan.loadRegulationText>;

type Event = ReturnType<typeof koleksi.timeline>[number];

const groups = [
  ["diubah", "Diubah"],
  ["disisipkan", "Pasal baru"],
  ["dihapus", "Dihapus"],
] as const;

const kindRoles = {
  pendahulu: "Digantikan",
  pokok: "Undang-undang pokok",
  dicabut: "Dicabut",
  "ditetapkan-dari": "Ditetapkan menjadi undang-undang",
};

export const statusOf = (status: string | null | undefined) =>
  isPresent(status)
    ? { key: status, label: peraturan.STATUS_LABEL[status] ?? status }
    : undefined;

const lawHref = (id: string) => {
  const lawPath = peraturan.pathOf(id);

  return lawPath === undefined ? undefined : `/${lawPath}`;
};

/** The timeline of a collection with no merged text (components: collection-timeline.tsx). */
export const timelineRecord = (collection: Collection, document: Document) => {
  const baseHref = `/${peraturan.lawPath(collection.base)}`;

  const compared = new Set(
    amendments.amendmentSteps(collection.base, document).map((s) => s.by.id)
  );

  const anchors = new Map((document?.pasal ?? []).map((p) => [p.num, p.eId]));

  const changeHref = (by: string, kind: string, num: string) => {
    if (compared.has(by)) {
      return `${baseHref}?bandingkan=${by}#pasal-${display.pasalKey(num)}`;
    }

    const anchor = anchors.get(num);

    return kind !== "disisipkan" && anchor !== undefined
      ? `${baseHref}#${anchor}`
      : undefined;
  };

  const lawEvent = (
    event: Exclude<Event, { kind: "tidak-tersedia" }>,
    dotted: boolean
  ) => {
    const { law } = event;
    const full = "subject" in law ? law : undefined;
    const subject = full?.subject;

    const changes =
      event.kind === "perubahan"
        ? peraturan
            .rel(event.law)
            .amends.find((entry) => entry.id === collection.base.id)?.changes
        : undefined;

    return {
      kind: event.kind,
      dotted,
      date: event.date,
      role:
        event.kind === "perubahan"
          ? `Perubahan ${koleksi.ordinal(event.order)}`
          : kindRoles[event.kind],
      law: { label: peraturan.citeId(law.id), href: lawHref(law.id) },
      subject: isPresent(subject) ? subject : undefined,
      noText:
        full !== undefined &&
        !full.versions.some((entry) => isPresent(entry.text)),
      status: event.kind === "pokok" ? statusOf(full?.status) : undefined,
      changes: groups.flatMap(([key, label]) => {
        const nums = changes?.[key] ?? [];

        return nums.length === 0
          ? []
          : [
              {
                key,
                label,
                items: nums.map((num) => ({
                  num,
                  href: changeHref(law.id, key, num),
                })),
              },
            ];
      }),
      compareHref:
        event.kind === "perubahan" && compared.has(law.id)
          ? `${baseHref}?bandingkan=${law.id}`
          : undefined,
    };
  };

  const events = koleksi.timeline(collection);

  return {
    count: koleksi
      .members(collection)
      .filter((member) => member.role !== "pendahulu").length,
    amended: koleksi.amendments(collection),
    status: statusOf(collection.base.status) ?? null,
    base: {
      label: peraturan.citeId(collection.base.id),
      href: baseHref,
    },
    detailed: amendments.hasAmendmentSteps(collection.base),
    events: events.map((event, index) => {
      const next = events[index + 1];

      const dotted =
        event.kind === "tidak-tersedia" || next?.kind === "tidak-tersedia";

      return event.kind === "tidak-tersedia"
        ? {
            kind: event.kind,
            dotted,
            what: event.what,
            id: event.id === undefined ? undefined : peraturan.citeId(event.id),
            why: event.why,
          }
        : lawEvent(event, dotted);
    }),
  };
};
