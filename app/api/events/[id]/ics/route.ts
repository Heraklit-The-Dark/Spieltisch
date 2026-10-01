import { queryOne, type EventRow } from "@/lib/db";

export const dynamic = "force-dynamic";

const icsDate = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsDay = (iso: string) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date(iso)).replace(/-/g, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Zeilen über 75 Zeichen gemäß RFC 5545 umbrechen. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = " " + rest.slice(74);
  }
  out.push(rest);
  return out.join("\r\n");
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Nicht gefunden", { status: 404 });
  const e = await queryOne<EventRow>("select * from events where id = $1", [id]);
  if (!e) return new Response("Nicht gefunden", { status: 404 });

  const start = e.time_known ? `DTSTART:${icsDate(e.starts_at)}` : `DTSTART;VALUE=DATE:${icsDay(e.starts_at)}`;
  const endIso = e.ends_at ?? new Date(Date.parse(e.starts_at) + 3 * 3600 * 1000).toISOString();
  const end = e.time_known ? `DTEND:${icsDate(endIso)}` : "";
  const location = [e.venue, e.address, e.city].filter(Boolean).join(", ");
  const desc = [e.summary, e.description, e.registration_url ? `Anmeldung: ${e.registration_url}` : "", e.source_url ? `Quelle: ${e.source_url}` : ""]
    .filter(Boolean)
    .join("\n\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Spieltisch Rhein-Main//DE",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${e.id}@spieltisch`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    start,
    end,
    `SUMMARY:${esc(e.status === "abgesagt" ? `[ABGESAGT] ${e.title}` : e.title)}`,
    location ? `LOCATION:${esc(location)}` : "",
    desc ? `DESCRIPTION:${esc(desc)}` : "",
    e.source_url ? `URL:${e.source_url}` : "",
    e.status === "abgesagt" ? "STATUS:CANCELLED" : "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .map(fold);

  const filename = e.title.replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 50) || "event";
  return new Response(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}.ics"`,
    },
  });
}
