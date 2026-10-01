import assert from "node:assert/strict";
import { htmlToText } from "../lib/sources/website";
import { dedupeKey, titleSimilarity, berlinDate } from "../lib/dedupe";
import { inQuietHours } from "../lib/notify";
import { distanceFromFrankfurt, cityMatches } from "../lib/geo";
import { shouldNotifyNew } from "../lib/pipeline";
import ical from "node-ical";

const html = `<html><head><script>x()</script><script type="application/ld+json">{"@type":"Event","name":"Neuheiten-Abend","startDate":"2026-10-20T19:00"}</script></head>
<body><nav>Menü</nav><main><h1>Events</h1><p>Spieleabend am <b>14.10.</b> ab 19 Uhr. <a href="/anmeldung">Hier anmelden</a></p></main></body></html>`;
const t = htmlToText(html, "https://laden.de/events");
assert.ok(t.includes("Hier anmelden [https://laden.de/anmeldung]"), t);
assert.ok(t.includes("JSON-LD") && t.includes("Neuheiten-Abend"));
assert.ok(!t.includes("x()"));
console.log("✓ htmlToText");

assert.equal(dedupeKey("Spieleabend im Playce!", "2026-10-14T17:00:00Z", "Playce"), dedupeKey("spieleabend playce", "2026-10-14T19:30:00+02:00", "playce"));
assert.notEqual(dedupeKey("Spieleabend", "2026-10-14T17:00:00Z", "Playce"), dedupeKey("Spieleabend", "2026-10-15T17:00:00Z", "Playce"));
assert.ok(titleSimilarity("Brettspielabend im Playce", "Brettspielabend Playce Frankfurt") >= 0.6);
assert.equal(berlinDate("2026-10-14T22:30:00Z"), "2026-10-15");
console.log("✓ Duplikaterkennung");

const q = { quiet_start: "22:00", quiet_end: "08:00" };
assert.equal(inQuietHours(q, new Date("2026-10-01T21:30:00Z")), true);  // 23:30 Berlin
assert.equal(inQuietHours(q, new Date("2026-10-01T06:00:00Z")), false); // 08:00 Berlin
assert.equal(inQuietHours(q, new Date("2026-10-01T05:59:00Z")), true);  // 07:59 Berlin
console.log("✓ Stille Zeiten");

assert.equal(distanceFromFrankfurt("Frankfurt am Main"), 0);
assert.ok(distanceFromFrankfurt("Darmstadt")! > 20 && distanceFromFrankfurt("Darmstadt")! < 35);
assert.equal(distanceFromFrankfurt("Atlantis"), null);
assert.ok(cityMatches("Frankfurt am Main", ["Frankfurt"]));
assert.ok(!cityMatches("Mainz", ["Frankfurt", "Offenbach"]));
console.log("✓ Umkreis & Orte");

const settings = { id: 1 as const, notifications_on: true, radius_km: 40, preferred_cities: [], quiet_start: "22:00", quiet_end: "08:00", notify_recurring: false, channel_webpush: true, channel_telegram: true, channel_ntfy: false };
assert.equal(shouldNotifyNew({ city: "Frankfurt", is_recurring: false, is_novelty: false, status: "geplant" }, settings), true);
assert.equal(shouldNotifyNew({ city: "Frankfurt", is_recurring: true, is_novelty: false, status: "geplant" }, settings), false);
assert.equal(shouldNotifyNew({ city: "Frankfurt", is_recurring: true, is_novelty: true, status: "geplant" }, settings), true);
assert.equal(shouldNotifyNew({ city: "Gießen", is_recurring: false, is_novelty: false, status: "geplant" }, settings), false);
assert.equal(shouldNotifyNew({ city: null, is_recurring: false, is_novelty: false, status: "geplant" }, settings), true);
console.log("✓ Benachrichtigungsregeln");

const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:1\r\nDTSTART:20261020T170000Z\r\nDTEND:20261020T210000Z\r\nSUMMARY:Board Game Night @ The Fizz\r\nLOCATION:The Fizz, Frankfurt\r\nURL:https://www.meetup.com/x/events/1/\r\nDESCRIPTION:Bring your games!\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
const parsed = ical.sync.parseICS(ics);
const ev = Object.values(parsed).find((x) => x?.type === "VEVENT") as any;
assert.equal(ev.summary, "Board Game Night @ The Fizz");
assert.equal(new Date(ev.start).toISOString(), "2026-10-20T17:00:00.000Z");
console.log("✓ iCal-Parsing");

// ───── Kostenlose Erkennung ─────
import { eventsFromText, eventsFromJsonLd, berlinIso, parseLocalOrIso } from "../lib/extract-free";
assert.equal(berlinIso(2026, 10, 14, 19, 0), "2026-10-14T17:00:00.000Z"); // Sommerzeit
assert.equal(berlinIso(2026, 12, 4, 19, 0), "2026-12-04T18:00:00.000Z"); // Winterzeit
assert.equal(parseLocalOrIso("2026-12-04T19:00")!.iso, "2026-12-04T18:00:00.000Z");

const page = `Veranstaltungen
Fr, 16.10. | 19:00 Uhr | Neuheiten-Abend: Spiele aus Essen Jetzt anmelden [https://laden.de/anmeldung]
Samstag 24. Oktober ab 14 Uhr Catan-Turnier
Öffnungszeiten: 10.10. geschlossen
12.12.2026 Weihnachtsfeier der Buchhaltung`;
const found = eventsFromText(page, "Testladen", "Frankfurt", "https://laden.de", new Date("2026-10-01T10:00:00Z"));
assert.equal(found.length, 2, JSON.stringify(found.map(f => f.title)));
assert.equal(found[0].title, "Neuheiten-Abend Spiele aus Essen");
assert.equal(found[0].start, "2026-10-16T17:00:00.000Z");
assert.equal(found[0].registration, "ja"); assert.equal(found[0].registration_url, "https://laden.de/anmeldung");
assert.ok(found[0].is_novelty);
assert.equal(found[1].start, "2026-10-24T12:00:00.000Z"); assert.ok(found[1].is_novelty); // Turnier
console.log("✓ Kostenlose Erkennung aus Websitetext");

const ld = eventsFromJsonLd([JSON.stringify({ "@context": "https://schema.org", "@graph": [{ "@type": "Event", name: "Spieleabend", startDate: "2026-11-05T19:00", location: { "@type": "Place", name: "Playce", address: { streetAddress: "Leipziger Str. 1", postalCode: "60487", addressLocality: "Frankfurt am Main" } }, offers: { price: 8, priceCurrency: "EUR", url: "https://playce.example/tickets" } }] })], null, "https://playce.example");
assert.equal(ld.length, 1); assert.equal(ld[0].start, "2026-11-05T18:00:00.000Z"); assert.equal(ld[0].venue, "Playce");
assert.equal(ld[0].registration_url, "https://playce.example/tickets"); assert.equal(ld[0].cost, "8 €");
console.log("✓ schema.org-Events");
