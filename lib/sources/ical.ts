import ical, { type VEvent } from "node-ical";
import type { Source } from "@/lib/db";
import { MAX_TEXT_CHARS, politeFetch, type RawDocument, type SourceAdapter } from "./types";
import { isAllowedByRobots } from "./robots";
import { eventsFromIcal, type IcalItem } from "@/lib/extract-free";

const fmt = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  dateStyle: "full",
  timeStyle: "short",
});

/** Kalender-Feeds (z. B. Meetup: https://www.meetup.com/<gruppe>/events/ical/). */
export const icalAdapter: SourceAdapter = {
  type: "ical",
  available: () => ({ ok: true }),
  async fetch(source: Source): Promise<RawDocument[]> {
    if (source.url.includes("<")) throw new Error("URL enthält noch einen Platzhalter.");
    if (!(await isAllowedByRobots(source.url))) throw new Error("robots.txt erlaubt den Abruf nicht.");

    const res = await politeFetch(source.url, { headers: { Accept: "text/calendar" } });
    const data = ical.sync.parseICS(await res.text());

    const now = Date.now();
    const horizon = now + 120 * 24 * 3600 * 1000;
    const blocks: string[] = [];
    const items: IcalItem[] = [];

    for (const item of Object.values(data)) {
      if (!item || item.type !== "VEVENT") continue;
      const ev = item as VEvent;
      const start = ev.start ? new Date(ev.start as unknown as Date) : null;
      if (!start || start.getTime() < now - 6 * 3600 * 1000 || start.getTime() > horizon) continue;
      const end = ev.end ? new Date(ev.end as unknown as Date) : null;
      const str = (v: unknown) => (typeof v === "string" ? v : v && typeof v === "object" && "val" in v ? String((v as { val: unknown }).val) : "");

      items.push({
        summary: str(ev.summary),
        start,
        end,
        dateOnly: (ev.start as unknown as { dateOnly?: boolean })?.dateOnly === true || ev.datetype === "date",
        location: str(ev.location),
        url: str(ev.url),
        description: str(ev.description),
        recurring: Boolean(ev.rrule),
        cancelled: String(ev.status ?? "").toUpperCase() === "CANCELLED",
      });

      blocks.push(
        [
          `TITEL: ${str(ev.summary)}`,
          `START: ${fmt.format(start)} (ISO ${start.toISOString()})`,
          end ? `ENDE: ${fmt.format(end)} (ISO ${end.toISOString()})` : "",
          ev.location ? `ORT: ${str(ev.location)}` : "",
          ev.url ? `LINK: ${str(ev.url)}` : "",
          ev.rrule ? "WIEDERHOLUNG: ja (Serientermin)" : "",
          ev.status ? `STATUS: ${ev.status}` : "",
          `BESCHREIBUNG: ${str(ev.description).slice(0, 1500)}`,
        ]
          .filter(Boolean)
          .join("\n"),
      );
    }

    if (!blocks.length) return [];
    return [
      {
        url: source.url,
        text: blocks.join("\n\n---\n\n").slice(0, MAX_TEXT_CHARS),
        kind: "Kalender-Feed (iCal)",
        events: eventsFromIcal(items, source.city, source.url),
      },
    ];
  },
};
