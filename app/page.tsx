import Link from "next/link";
import { isDbConfigured, query, type EventRow } from "@/lib/db";
import { DateTile } from "@/components/DateTile";
import { CheckNowButton } from "@/components/CheckNowButton";
import { SetupNotice } from "@/components/SetupNotice";
import { cityColor } from "@/lib/colors";

export const dynamic = "force-dynamic";

type Search = { ort?: string; neu?: string; anmeldung?: string };

const NEW_WINDOW_MS = 3 * 24 * 3600 * 1000;

function timeLabel(e: EventRow) {
  if (!e.time_known) return "Uhrzeit offen";
  return new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }).format(new Date(e.starts_at)) + " Uhr";
}

/** Gruppiert nach „Diese Woche“, „Nächste Woche“, danach nach Monat. */
function groupLabel(iso: string, now: Date): string {
  const berlin = (d: Date) => new Date(d.toLocaleString("en-US", { timeZone: "Europe/Berlin" }));
  const n = berlin(now);
  const d = berlin(new Date(iso));
  const mondayOf = (x: Date) => {
    const m = new Date(x);
    m.setHours(0, 0, 0, 0);
    m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
    return m.getTime();
  };
  const weeks = Math.round((mondayOf(d) - mondayOf(n)) / (7 * 24 * 3600 * 1000));
  if (weeks <= 0) return "Diese Woche";
  if (weeks === 1) return "Nächste Woche";
  const month = new Intl.DateTimeFormat("de-DE", { month: "long", year: d.getFullYear() !== n.getFullYear() ? "numeric" : undefined }).format(d);
  return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear() ? `Später im ${month}` : month;
}

function chipHref(current: Search, patch: Partial<Search>) {
  const next = { ...current, ...patch };
  const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]).toString();
  return qs ? `/?${qs}` : "/";
}

export default async function EventsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  if (!isDbConfigured()) return <SetupNotice />;

  const now = new Date();
  let all: EventRow[] = [];
  let error: Error | null = null;
  try {
    all = await query<EventRow>("select * from events where starts_at >= $1 order by starts_at limit 300", [
      new Date(now.getTime() - 3 * 3600 * 1000).toISOString(),
    ]);
  } catch (err) {
    error = err as Error;
  }

  const cities = Array.from(new Set(all.map((e) => e.city).filter(Boolean) as string[])).sort();
  const isNew = (e: EventRow) => now.getTime() - Date.parse(e.first_seen_at) < NEW_WINDOW_MS;

  const list = all.filter(
    (e) =>
      (!sp.ort || e.city === sp.ort) &&
      (!sp.neu || isNew(e)) &&
      (!sp.anmeldung || e.registration === "ja"),
  );

  const groups = new Map<string, EventRow[]>();
  for (const e of list) {
    const label = groupLabel(e.starts_at, now);
    groups.set(label, [...(groups.get(label) ?? []), e]);
  }

  const chip = (active: boolean) =>
    `shrink-0 h-9 px-3.5 rounded-full text-sm border flex items-center gap-1.5 ${
      active ? "bg-ink text-paper border-ink font-bold" : "bg-card border-line text-ink"
    }`;

  return (
    <main>
      <header className="px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-3 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[2rem] leading-none font-extrabold tracking-tight">Spieltisch</h1>
          <p className="text-muted text-sm mt-1">Brettspiel-Events in Frankfurt und Umgebung</p>
        </div>
        <CheckNowButton />
      </header>

      <div className="flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none]" role="toolbar" aria-label="Filter">
        <Link href={chipHref(sp, { neu: sp.neu ? undefined : "1" })} className={chip(Boolean(sp.neu))}>
          Nur neue
        </Link>
        <Link href={chipHref(sp, { anmeldung: sp.anmeldung ? undefined : "1" })} className={chip(Boolean(sp.anmeldung))}>
          Mit Anmeldung
        </Link>
        <span className="w-px bg-line shrink-0 my-1" aria-hidden />
        <Link href={chipHref(sp, { ort: undefined })} className={chip(!sp.ort)}>
          Alle Orte
        </Link>
        {cities.map((c) => (
          <Link key={c} href={chipHref(sp, { ort: sp.ort === c ? undefined : c })} className={chip(sp.ort === c)}>
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: cityColor(c).bg }} aria-hidden />
            {c}
          </Link>
        ))}
      </div>

      {error && <p className="mx-4 rounded-xl bg-card border border-danger text-danger p-3 text-sm">Events konnten nicht geladen werden: {error.message}</p>}

      {!error && list.length === 0 && (
        <div className="mx-4 mt-6 rounded-2xl border border-dashed border-line p-6 text-center">
          <p className="font-display text-xl font-bold">Der Tisch ist noch leer</p>
          <p className="text-muted mt-2">
            {all.length
              ? "Für diese Filter gibt es keine Events. Setze die Filter zurück, um alle zu sehen."
              : "Tippe auf „Jetzt prüfen“, um die Quellen zum ersten Mal abzurufen. Beim ersten Abruf werden Events still gespeichert, danach meldet die App nur Neues."}
          </p>
        </div>
      )}

      {Array.from(groups.entries()).map(([label, items]) => (
        <section key={label} className="mt-4" aria-labelledby={`g-${label}`}>
          <h2 id={`g-${label}`} className="px-4 mb-2 font-display text-lg font-bold text-muted">
            {label}
          </h2>
          <ul className="px-3 space-y-2">
            {items.map((e, i) => (
              <li key={e.id}>
                <Link
                  href={`/events/${e.id}`}
                  className={`flex gap-3 rounded-2xl bg-card border border-line p-3 active:scale-[0.99] transition-transform ${
                    e.status === "abgesagt" ? "opacity-70" : ""
                  }`}
                >
                  <DateTile startsAt={e.starts_at} city={e.city} cancelled={e.status === "abgesagt"} animate={isNew(e) && i < 6} />
                  <div className="min-w-0 flex-1">
                    <p className={`font-display font-bold text-[1.05rem] leading-snug ${e.status === "abgesagt" ? "line-through" : ""}`}>{e.title}</p>
                    <p className="text-sm text-muted truncate">
                      {timeLabel(e)}
                      {e.venue || e.city ? `, ${[e.venue, e.city].filter(Boolean).join(", ")}` : ""}
                    </p>
                    {e.summary && <p className="text-sm mt-1 line-clamp-2">{e.summary}</p>}
                    <div className="flex flex-wrap gap-1.5 mt-2 empty:hidden">
                      {e.status === "abgesagt" && <Badge tone="danger">Abgesagt</Badge>}
                      {isNew(e) && e.status !== "abgesagt" && <Badge tone="signal">Neu</Badge>}
                      {e.is_novelty && <Badge tone="felt">Neuheiten & Specials</Badge>}
                      {e.registration === "ja" && <Badge tone="plain">Anmeldung nötig</Badge>}
                      {e.is_recurring && <Badge tone="plain">Regelmäßig</Badge>}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}

function Badge({ tone, children }: { tone: "signal" | "felt" | "plain" | "danger"; children: React.ReactNode }) {
  const cls = {
    signal: "bg-signal text-[#2A2205] font-bold",
    felt: "bg-felt-soft text-felt font-bold",
    plain: "border border-line text-muted",
    danger: "bg-danger text-white font-bold",
  }[tone];
  return <span className={`text-xs px-2 py-0.5 rounded-md ${cls}`}>{children}</span>;
}
