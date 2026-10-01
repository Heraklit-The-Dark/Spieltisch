/**
 * Kostenlose Event-Erkennung ohne KI.
 *
 * Reihenfolge der Qualität:
 *  1. Kalender-Feeds (iCal, z. B. Meetup) → exakte Daten
 *  2. schema.org-Event-Daten (JSON-LD), die viele Websites für Google einbetten → exakte Daten
 *  3. Textzeilen mit Datum + Spiele-Stichwort → gute Näherung, Details auf der Website
 */
import type { ExtractedEvent } from "@/lib/extract";
import type { RawDocument } from "@/lib/sources/types";
import { KNOWN_CITIES } from "@/lib/geo";

// ───────────────────────── Datum & Zeitzone ─────────────────────────

/** Versatz von Europe/Berlin zu UTC (in Minuten) für ein bestimmtes Datum – berücksichtigt Sommerzeit. */
function berlinOffsetMinutes(utcGuess: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(utcGuess);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((asUtc - utcGuess.getTime()) / 60000);
}

/** Berliner Ortszeit → ISO-String mit korrektem Versatz. */
export function berlinIso(y: number, m: number, d: number, h = 0, min = 0): string {
  const guess = new Date(Date.UTC(y, m - 1, d, h, min));
  const off = berlinOffsetMinutes(guess);
  return new Date(guess.getTime() - off * 60000).toISOString();
}

/** Datumsangabe ohne Zeitzone (z. B. „2026-10-14T19:00“) als Berliner Zeit deuten. */
export function parseLocalOrIso(value: string): { iso: string; timeKnown: boolean } | null {
  const v = value.trim();
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(v)) {
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : { iso: new Date(t).toISOString(), timeKnown: /T\d/.test(v) };
  }
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) return null;
  return { iso: berlinIso(+m[1], +m[2], +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0), timeKnown: Boolean(m[4]) };
}

// ───────────────────────── Hilfen ─────────────────────────

const NOVELTY = /neuheit|turnier|premiere|vorab|spielemesse|messe|essen\s*\d{2}|launch|release|prototyp|tournament|new games|sonderevent|special/i;
const RECURRING = /jeden|jede woche|wöchentlich|regelmäßig|immer (mon|diens|mittwoch|donners|frei|sams|sonn)tags?|every (week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|weekly/i;
const CANCELLED = /abgesagt|fällt aus|entfällt|cancel+ed|verschoben/i;
const REGISTRATION = /anmeld|ticket|registr|rsvp|platz reservieren|reservierung|tickets?/i;
const GAME_WORDS =
  /spiel|brett|tabletop|turnier|treff|neuheit|demo|workshop|board ?game|game night|meeple|würfel|karten|rollenspiel|pen ?(&|and|und) ?paper|tcg|magic|warhammer|stammtisch|spieleabend/i;
const NOISE = /öffnungszeit|geschlossen|feiertag|betriebsurlaub|impressum|datenschutz|©|copyright|versand|lieferzeit|bestellung|warenkorb|newsletter/i;

const firstUrl = (s: string) => s.match(/\[(https?:\/\/[^\]\s]+)\]/)?.[1] ?? null;
const stripLinks = (s: string) => s.replace(/\s*\[https?:\/\/[^\]\s]+\]/g, "").replace(/\s+/g, " ").trim();

function cityFrom(text: string | null | undefined, fallback: string | null): string | null {
  if (!text) return fallback;
  const t = text.toLowerCase();
  const hit = KNOWN_CITIES.find((c) => new RegExp(`\\b${c.toLowerCase().replace(/[-]/g, "[- ]")}\\b`).test(t));
  return hit ?? fallback;
}

function base(partial: Partial<ExtractedEvent> & Pick<ExtractedEvent, "title" | "start">): ExtractedEvent {
  return {
    organizer: null,
    venue: null,
    address: null,
    city: null,
    end: null,
    time_known: true,
    summary: null,
    description: null,
    cost: null,
    registration: "unklar",
    registration_url: null,
    event_url: null,
    is_recurring: false,
    is_novelty: false,
    status: "geplant",
    ...partial,
  };
}

// ───────────────────────── 1. iCal ─────────────────────────

export interface IcalItem {
  summary: string;
  start: Date;
  end: Date | null;
  dateOnly: boolean;
  location: string;
  url: string;
  description: string;
  recurring: boolean;
  cancelled: boolean;
}

export function eventsFromIcal(items: IcalItem[], sourceCity: string | null, feedUrl: string): ExtractedEvent[] {
  return items.map((it) => {
    const isMeetup = /meetup\.com/i.test(feedUrl) || /meetup\.com/i.test(it.url);
    const parts = it.location.split(",").map((p) => p.trim()).filter(Boolean);
    const text = `${it.summary}\n${it.description}`;
    const desc = it.description.replace(/\s+/g, " ").trim();
    return base({
      title: it.summary.trim() || "Spieleabend",
      start: it.start.toISOString(),
      end: it.end ? it.end.toISOString() : null,
      time_known: !it.dateOnly,
      venue: parts[0] ?? null,
      address: parts.slice(1).join(", ") || null,
      city: cityFrom(it.location, sourceCity),
      summary: desc ? desc.slice(0, 220) + (desc.length > 220 ? " …" : "") : null,
      description: desc ? desc.slice(0, 1200) : null,
      registration: isMeetup || REGISTRATION.test(text) ? "ja" : "unklar",
      registration_url: isMeetup ? it.url || null : null,
      event_url: it.url || null,
      is_recurring: it.recurring || RECURRING.test(text),
      is_novelty: NOVELTY.test(text),
      status: it.cancelled || CANCELLED.test(it.summary) ? "abgesagt" : "geplant",
    });
  });
}

// ───────────────────────── 2. schema.org / JSON-LD ─────────────────────────

type Json = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === "string" ? v : "");

function collectEvents(node: unknown, out: Json[]) {
  if (Array.isArray(node)) return node.forEach((n) => collectEvents(n, out));
  if (!node || typeof node !== "object") return;
  const obj = node as Json;
  const type = obj["@type"];
  const types = Array.isArray(type) ? type.map(String) : [String(type ?? "")];
  if (types.some((t) => /Event$/i.test(t))) out.push(obj);
  if (obj["@graph"]) collectEvents(obj["@graph"], out);
  if (obj.subEvent) collectEvents(obj.subEvent, out);
}

export function eventsFromJsonLd(blocks: string[], sourceCity: string | null, pageUrl: string): ExtractedEvent[] {
  const raw: Json[] = [];
  for (const b of blocks) {
    try {
      collectEvents(JSON.parse(b), raw);
    } catch {
      /* ungültiges JSON ignorieren */
    }
  }
  const out: ExtractedEvent[] = [];
  for (const e of raw) {
    const start = parseLocalOrIso(str(e.startDate));
    if (!start) continue;
    const end = e.endDate ? parseLocalOrIso(str(e.endDate)) : null;
    const loc = (Array.isArray(e.location) ? e.location[0] : e.location) as Json | string | undefined;
    const locName = typeof loc === "string" ? loc : str(loc?.name);
    const addr = typeof loc === "object" && loc ? (loc.address as Json | string | undefined) : undefined;
    const address =
      typeof addr === "string" ? addr : addr ? [str(addr.streetAddress), [str(addr.postalCode), str(addr.addressLocality)].filter(Boolean).join(" ")].filter(Boolean).join(", ") : "";
    const locality = typeof addr === "object" && addr ? str(addr.addressLocality) : "";
    const offers = (Array.isArray(e.offers) ? e.offers[0] : e.offers) as Json | undefined;
    const price = offers ? str(offers.price) || (typeof offers.price === "number" ? String(offers.price) : "") : "";
    const desc = stripLinks(str(e.description).replace(/<[^>]+>/g, " "));
    const text = `${str(e.name)} ${desc}`;
    const url = str(e.url) || pageUrl;

    out.push(
      base({
        title: stripLinks(str(e.name)) || "Spieleabend",
        start: start.iso,
        end: end?.iso ?? null,
        time_known: start.timeKnown,
        venue: locName || null,
        address: address || null,
        city: locality || cityFrom(`${locName} ${address}`, sourceCity),
        organizer: typeof e.organizer === "object" && e.organizer ? str((e.organizer as Json).name) || null : null,
        summary: desc ? desc.slice(0, 220) + (desc.length > 220 ? " …" : "") : null,
        description: desc ? desc.slice(0, 1200) : null,
        cost: price ? (price === "0" || price === "0.00" ? "kostenlos" : `${price} ${str(offers?.priceCurrency) || "€"}`.replace("EUR", "€")) : null,
        registration: offers?.url || REGISTRATION.test(text) ? "ja" : "unklar",
        registration_url: str(offers?.url) || null,
        event_url: url,
        is_recurring: RECURRING.test(text),
        is_novelty: NOVELTY.test(text),
        status: /Cancelled|Postponed/i.test(str(e.eventStatus)) || CANCELLED.test(str(e.name)) ? "abgesagt" : "geplant",
      }),
    );
  }
  return out;
}

// ───────────────────────── 3. Datumszeilen im Text ─────────────────────────

const MONTHS: Record<string, number> = {
  jan: 1, januar: 1, january: 1, feb: 2, februar: 2, february: 2, mär: 3, märz: 3, mar: 3, march: 3, maerz: 3,
  apr: 4, april: 4, mai: 5, may: 5, jun: 6, juni: 6, june: 6, jul: 7, juli: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, okt: 10, oktober: 10, oct: 10, october: 10, nov: 11, november: 11,
  dez: 12, dezember: 12, dec: 12, december: 12,
};
const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");

const DATE_PATTERNS: { re: RegExp; get: (m: RegExpMatchArray) => [number, number, number | null] }[] = [
  { re: /\b(20\d{2})-(\d{2})-(\d{2})\b/, get: (m) => [+m[3], +m[2], +m[1]] },
  { re: /\b(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})?(?!\d)/, get: (m) => [+m[1], +m[2], m[3] ? +(m[3].length === 2 ? `20${m[3]}` : m[3]) : null] },
  { re: new RegExp(`\\b(\\d{1,2})\\.?\\s*(${MONTH_RE})\\.?(?:\\s+(20\\d{2}))?\\b`, "i"), get: (m) => [+m[1], MONTHS[m[2].toLowerCase()], m[3] ? +m[3] : null] },
];

function findDate(line: string): { day: number; month: number; year: number | null; rest: string } | null {
  for (const p of DATE_PATTERNS) {
    const m = line.match(p.re);
    if (!m) continue;
    const [day, month, year] = p.get(m);
    if (day < 1 || day > 31 || month < 1 || month > 12) continue;
    return { day, month, year, rest: line.replace(m[0], " ") };
  }
  return null;
}

function findTime(s: string): { h: number; min: number } | null {
  const m = s.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\s*(?:uhr|h)?\b/i) ?? s.match(/\b([01]?\d|2[0-3])\s*uhr\b/i);
  if (!m) return null;
  return { h: +m[1], min: m[2] && /^\d{2}$/.test(m[2]) ? +m[2] : 0 };
}

function cleanTitle(s: string): string {
  return stripLinks(s)
    .replace(/\b(mo|di|mi|do|fr|sa|so|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b\.?,?/gi, " ")
    .replace(/\b(jetzt|hier)\s+(anmelden|registrieren|tickets?( sichern| kaufen)?|reservieren)\b|\bmehr (erfahren|infos?|details)\b|\b(weiterlesen|details)\b/gi, " ")
    .replace(/\b(ab|um|von|bis|uhr)\b/gi, " ")
    .replace(/\s[-–—]\s|[|•·–—/]+|[:,](?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.;!\s]+$/, "");
}

export function eventsFromText(text: string, sourceName: string, sourceCity: string | null, pageUrl: string, now = new Date()): ExtractedEvent[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const out = new Map<string, ExtractedEvent>();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  for (let i = 0; i < lines.length && out.size < 30; i++) {
    const line = lines[i];
    if (line.length > 400 || NOISE.test(line)) continue;
    const date = findDate(line);
    if (!date) continue;

    const window = [lines[i - 1] ?? "", line, lines[i + 1] ?? "", lines[i + 2] ?? ""].join(" \n ");
    if (!GAME_WORDS.test(window) && !GAME_WORDS.test(sourceName)) continue;

    // Jahr ergänzen: nächstes passendes Datum ab heute
    let year = date.year ?? now.getUTCFullYear();
    if (!date.year && Date.UTC(year, date.month - 1, date.day) < today - 86400000) year++;
    const when = Date.UTC(year, date.month - 1, date.day);
    if (when < today - 86400000 || when > today + 200 * 86400000) continue;

    const time = findTime(date.rest) ?? findTime(lines[i + 1] ?? "");
    let title = cleanTitle(date.rest.replace(/\b([01]?\d|2[0-3])([:.][0-5]\d)?\s*(uhr|h)\b/gi, " ").replace(/\b([01]?\d|2[0-3])[:.][0-5]\d\b/g, " "));
    if (title.length < 5 || !/[a-zäöü]{3}/i.test(title)) {
      const neighbour = [lines[i - 1], lines[i + 1]].map((l) => (l ? cleanTitle(l) : "")).find((l) => l.length >= 5 && !findDate(l) && !NOISE.test(l));
      title = neighbour ?? `Termin bei ${sourceName}`;
    }
    if (title.length > 110) title = title.slice(0, 107).replace(/\s\S*$/, "") + " …";

    const url = firstUrl(line) ?? firstUrl(lines[i + 1] ?? "");
    const summary = stripLinks(window.replace(/\n/g, " ")).slice(0, 200);
    const ev = base({
      title,
      start: berlinIso(year, date.month, date.day, time?.h ?? 0, time?.min ?? 0),
      time_known: Boolean(time),
      venue: sourceName,
      city: cityFrom(window, sourceCity),
      summary: summary ? `${summary}${summary.length >= 200 ? " …" : ""}` : null,
      description: "Automatisch aus der Website gelesen. Genaue Angaben bitte auf der Originalseite prüfen.",
      registration: REGISTRATION.test(window) ? "ja" : "unklar",
      registration_url: REGISTRATION.test(window) ? url : null,
      event_url: url ?? pageUrl,
      is_recurring: RECURRING.test(window),
      is_novelty: NOVELTY.test(window),
      status: CANCELLED.test(line) ? "abgesagt" : "geplant",
    });
    const key = `${ev.title.toLowerCase()}|${year}-${date.month}-${date.day}`;
    if (!out.has(key)) out.set(key, ev);
  }
  return [...out.values()];
}

/** Kostenlose Auswertung eines Dokuments. */
export function extractWithoutAI(doc: RawDocument, sourceName: string, sourceCity: string | null): ExtractedEvent[] {
  if (doc.events?.length) return doc.events;
  return eventsFromText(doc.text, sourceName, sourceCity, doc.url);
}
