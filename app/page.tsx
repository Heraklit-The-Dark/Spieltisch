import Link from "next/link";
import { isDbConfigured, query, type EventRow } from "@/lib/db";
import { DateTile } from "@/components/DateTile";
import { CheckNowButton } from "@/components/CheckNowButton";
import { SetupNotice } from "@/components/SetupNotice";
import { cityColor } from "@/lib/colors";

export const dynamic = "force-dynamic";

type Search = { q?: string; ort?: string; neu?: string };

const NEW_WINDOW_MS = 3 * 24 * 3600 * 1000;
const PAST_GRACE_MS = 3 * 3600 * 1000; // Events gelten bis 3 Std. nach Beginn als „laufend“

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

/** Suchbegriff für ILIKE vorbereiten: Platzhalterzeichen % und _ maskieren. */
const likePattern = (term: string) => `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export default async function EventsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  if (!isDbConfigured()) return <SetupNotice />;

  const now = new Date();
  const q = (sp.q ?? "").trim().slice(0, 100);
  const searching = q.length > 0;

  let rows: EventRow[] = [];
  let error: Error | null = null;
  try {
    if (searching) {
      // Suche über alle Events, auch vergangene. Jedes Wort muss irgendwo vorkommen.
      const words = q.split(/\s+/).filter(Boolean).slice(0, 6);
      const where = words
        .map(
          (_, i) =>
            `concat_ws(' ', title, summary, description, venue, address, city, organizer) ilike $${i + 1}`,
        )
        .join(" and ");
      rows = await query<EventRow>(
        `select * from events where ${where}
         order by (starts_at >= now() - interval '3 hours') desc,
                  case when starts_at >= now() - interval '3 hours' then starts_at end asc,
                  starts_at desc
         limit 100`,
        words.map(likePattern),
      );
    } else {
      rows = await query<EventRow>("select * from events where starts_at >= $1 order by starts_at limit 300", [
        new Date(now.getTime() - PAST_GRACE_MS).toISOString(),
      ]);
    }
  } catch (err) {
    error = err as Error;
  }

  const isNew = (e: EventRow) => now.getTime() - Date.parse(e.first_seen_at) < NEW_WINDOW_MS;
  const isPast = (e: EventRow) => Date.parse(e.starts_at) < now.getTime() - PAST_GRACE_MS;

  const cities = searching ? [] : Array.from(new Set(rows.map((e) => e.city).filter(Boolean) as string[])).sort();
  const list = searching ? rows : rows.filter((e) => (!sp.ort || e.city === sp.ort) && (!sp.neu || isNew(e)));

  // Gruppen: bei der Suche „Kommend“ und „Vergangen“, sonst nach Woche/Monat.
  const groups = new Map<string, EventRow[]>();
  for (const e of list) {
    const label = searching ? (isPast(e) ? "Vergangen" : "Kommend") : groupLabel(e.starts_at, now);
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

      <form action="/" method="get" role="search" className="px-4 pb-3">
        <label htmlFor="suche" className="sr-only">
          Events durchsuchen
        </label>
        <div className="relative">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            id="suche"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Suchen, auch vergangene Events"
            enterKeyHint="search"
            autoComplete="off"
            className="w-full h-12 rounded-xl border border-line bg-card pl-11 pr-24 text-base"
          />
          {searching ? (
            <Link href="/" className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 px-3 rounded-lg text-sm font-bold text-muted flex items-center">
              Zurücksetzen
            </Link>
          ) : (
            <button className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 px-3 rounded-lg bg-felt text-felt-ink text-sm font-bold">
              Suchen
            </button>
          )}
        </div>
      </form>

      {!searching && (
        <div className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="toolbar" aria-label="Filter">
          <Link href={chipHref(sp, { neu: sp.neu ? undefined : "1" })} className={chip(Boolean(sp.neu))}>
            Nur neue
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
      )}

      {searching && !error && (
        <p className="px-4 text-sm text-muted" role="status">
          {list.length === 0
            ? `Keine Events zu „${q}“ gefunden.`
            : `${list.length === 100 ? "Mindestens 100" : list.length} Treffer zu „${q}“`}
        </p>
      )}

      {error && <p className="mx-4 rounded-xl bg-card border border-danger text-danger p-3 text-sm">Events konnten nicht geladen werden: {error.message}</p>}

      {!error && !searching && list.length === 0 && (
        <div className="mx-4 mt-6 rounded-2xl border border-dashed border-line p-6 text-center">
          <p className="font-display text-xl font-bold">Der Tisch ist noch leer</p>
          <p className="text-muted mt-2">
            {rows.length
              ? "Für diese Filter gibt es keine Events. Setze die Filter zurück, um alle zu sehen."
              : "Tippe auf „Jetzt prüfen“, um die Quellen zum ersten Mal abzurufen. Beim ersten Abruf werden Events still gespeichert, danach meldet die App nur Neues."}
          </p>
        </div>
      )}

      {Array.from(groups.entries()).map(([label, items]) => (
        <section key={label} className="mt-4" aria-labelledby={`g-${label}`}>
          <h2 id={`g-${label}`} className="px-4 mb-1.5 font-display text-lg font-bold text-muted">
            {label}
          </h2>
          <ul className="mx-3 rounded-2xl bg-card border border-line divide-y divide-line overflow-hidden">
            {items.map((e) => {
              const past = isPast(e);
              const cancelled = e.status === "abgesagt";
              const place = [e.venue, e.city].filter(Boolean).join(", ");
              return (
                <li key={e.id}>
                  <Link href={`/events/${e.id}`} className={`flex items-center gap-3 px-3 py-2.5 active:bg-paper ${past || cancelled ? "opacity-65" : ""}`}>
                    <DateTile startsAt={e.starts_at} city={e.city} cancelled={cancelled} past={past} />
                    <div className="min-w-0 flex-1">
                      <p className={`font-display font-bold leading-snug line-clamp-2 ${cancelled ? "line-through" : ""}`}>{e.title}</p>
                      <p className="text-sm text-muted truncate">
                        {searching && past
                          ? new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", dateStyle: "medium" }).format(new Date(e.starts_at))
                          : timeLabel(e)}
                        {place ? `, ${place}` : ""}
                      </p>
                    </div>
                    {cancelled ? (
                      <Badge tone="danger">Abgesagt</Badge>
                    ) : !past && isNew(e) ? (
                      <Badge tone="signal">Neu</Badge>
                    ) : null}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="text-muted shrink-0" aria-hidden>
                      <path d="m9 6 6 6-6 6" />
                    </svg>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </main>
  );
}

function Badge({ tone, children }: { tone: "signal" | "danger"; children: React.ReactNode }) {
  const cls = { signal: "bg-signal text-[#2A2205]", danger: "bg-danger text-white" }[tone];
  return <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-md ${cls}`}>{children}</span>;
}
