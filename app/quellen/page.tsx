import { isDbConfigured, query, queryOne, type RunLog, type Source } from "@/lib/db";
import { SetupNotice } from "@/components/SetupNotice";
import { CheckNowButton } from "@/components/CheckNowButton";
import { adapters } from "@/lib/sources";
import { addSource, deleteSource, toggleSource, updateSource } from "./actions";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<Source["type"], string> = {
  website: "Webseite",
  ical: "Kalender-Feed",
  rss: "RSS-Feed",
  social: "Social Media",
};

function ago(iso: string | null): string {
  if (!iso) return "noch nie";
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.round(min / 60);
  if (h < 48) return `vor ${h} Std.`;
  return `vor ${Math.round(h / 24)} Tagen`;
}

function status(s: Source): { label: string; color: string } {
  if (!s.active) return { label: "Pausiert", color: "var(--muted)" };
  const ready = adapters[s.type].available();
  if (!ready.ok) return { label: "Modul inaktiv", color: "var(--muted)" };
  if (s.last_error && (!s.last_success_at || Date.parse(s.last_error_at ?? "") > Date.parse(s.last_success_at)))
    return { label: "Fehler", color: "var(--danger)" };
  if (s.last_success_at) return { label: "OK", color: "var(--felt)" };
  return { label: "Wartet auf ersten Abruf", color: "var(--signal)" };
}

export default async function SourcesPage() {
  if (!isDbConfigured()) return <SetupNotice />;
  const [sources, lastRun] = await Promise.all([
    query<Source>("select * from sources order by active desc, name"),
    queryOne<RunLog>("select * from run_logs order by started_at desc limit 1"),
  ]);

  return (
    <main className="px-4 pt-[max(env(safe-area-inset-top),1rem)]">
      <h1 className="font-display text-[2rem] leading-none font-extrabold">Quellen</h1>
      <p className="text-muted mt-2">Diese Seiten und Feeds werden täglich nach neuen Events durchsucht.</p>

      <div className="mt-4">
        <CheckNowButton variant="full" />
      </div>

      <ul className="mt-5 space-y-3">
        {sources.map((s) => {
          const st = status(s);
          const hasPlaceholder = s.url.includes("<");
          return (
            <li key={s.id} className={`rounded-2xl bg-card border border-line p-4 ${s.active ? "" : "opacity-75"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display font-bold text-lg leading-tight">{s.name}</p>
                  <p className="text-sm text-muted">
                    {TYPE_LABEL[s.type]}
                    {s.city ? `, ${s.city}` : ""}
                  </p>
                </div>
                <span className="shrink-0 inline-flex items-center gap-1.5 text-sm">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: st.color }} aria-hidden />
                  {st.label}
                </span>
              </div>

              <p className="text-sm mt-2">Letzter erfolgreicher Abruf: {ago(s.last_success_at)}</p>
              {s.last_error && st.label === "Fehler" && <p className="text-sm text-danger mt-1 break-words">{s.last_error}</p>}
              {s.notes && <p className="text-sm text-muted mt-1">{s.notes}</p>}

              <form action={updateSource} className="mt-3 flex gap-2">
                <input type="hidden" name="id" value={s.id} />
                <label className="sr-only" htmlFor={`url-${s.id}`}>Adresse</label>
                <input
                  id={`url-${s.id}`}
                  name="url"
                  type="url"
                  required
                  defaultValue={s.url}
                  className={`min-w-0 flex-1 h-10 rounded-lg border bg-paper px-3 text-sm ${hasPlaceholder ? "border-signal" : "border-line"}`}
                />
                <button className="h-10 px-3 rounded-lg border border-line text-sm font-bold">Speichern</button>
              </form>

              <div className="mt-3 flex gap-2">
                <form action={toggleSource}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="active" value={String(s.active)} />
                  <button className="h-9 px-3 rounded-lg bg-felt-soft text-felt text-sm font-bold">{s.active ? "Pausieren" : "Aktivieren"}</button>
                </form>
                <form action={deleteSource}>
                  <input type="hidden" name="id" value={s.id} />
                  <button className="h-9 px-3 rounded-lg text-danger text-sm">Entfernen</button>
                </form>
              </div>
            </li>
          );
        })}
      </ul>

      <section className="mt-8 rounded-2xl border border-line bg-card p-4">
        <h2 className="font-display text-xl font-bold">Quelle hinzufügen</h2>
        <form action={addSource} className="mt-3 space-y-3">
          <Field label="Name" name="name" placeholder="z. B. Spieletreff Hanau" />
          <Field label="Adresse" name="url" type="url" placeholder="https://…" />
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              Art
              <select name="type" className="mt-1 w-full h-10 rounded-lg border border-line bg-paper px-2">
                <option value="website">Webseite</option>
                <option value="ical">Kalender-Feed (iCal, z. B. Meetup)</option>
                <option value="rss">RSS-Feed</option>
                <option value="social">Instagram/Facebook</option>
              </select>
            </label>
            <Field label="Stadt" name="city" placeholder="Frankfurt" required={false} />
          </div>
          <p className="text-sm text-muted break-words">
            Tipp für Meetup-Gruppen: Art „Kalender-Feed“ und als Adresse https://www.meetup.com/gruppenname/events/ical/ eintragen.
          </p>
          <button className="w-full h-11 rounded-xl bg-felt text-felt-ink font-bold">Quelle hinzufügen</button>
        </form>
      </section>

      {lastRun && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-bold">Letzter Prüflauf</h2>
          <p className="text-sm text-muted mt-1">
            {new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", dateStyle: "medium", timeStyle: "short" }).format(new Date(lastRun.started_at))}
            , ausgelöst {lastRun.trigger === "cron" ? "automatisch" : lastRun.trigger === "github" ? "über GitHub Actions" : "von Hand"}.{" "}
            {lastRun.events_new} neue Events, {lastRun.notifications_sent} Nachrichten.
          </p>
          <pre className="mt-2 text-xs bg-card border border-line rounded-xl p-3 overflow-x-auto whitespace-pre-wrap">{(lastRun.log ?? []).join("\n") || "Kein Protokoll"}</pre>
        </section>
      )}
    </main>
  );
}

function Field({ label, name, type = "text", placeholder, required = true }: { label: string; name: string; type?: string; placeholder?: string; required?: boolean }) {
  return (
    <label className="block text-sm">
      {label}
      <input name={name} type={type} required={required} placeholder={placeholder} className="mt-1 w-full h-10 rounded-lg border border-line bg-paper px-3" />
    </label>
  );
}
