import Link from "next/link";
import { notFound } from "next/navigation";
import { isDbConfigured, query, queryOne, type EventRow, type Source } from "@/lib/db";
import { DateTile } from "@/components/DateTile";
import { SetupNotice } from "@/components/SetupNotice";
import { BackLink } from "@/components/BackLink";
import { formatWhen } from "@/lib/notify";
import { distanceFromFrankfurt } from "@/lib/geo";

export const dynamic = "force-dynamic";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isDbConfigured()) return <SetupNotice />;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const e = await queryOne<EventRow>("select * from events where id = $1", [id]);
  if (!e) notFound();
  const sources = await query<Pick<Source, "id" | "name">>("select id, name from sources where id = any($1::uuid[])", [e.source_ids]);

  const cancelled = e.status === "abgesagt";
  const past = Date.parse(e.starts_at) < Date.now() - 3 * 3600 * 1000;
  const where = [e.venue, e.address, !e.address?.includes(e.city ?? "§") ? e.city : null].filter(Boolean).join(", ");
  const mapQuery = encodeURIComponent([e.venue, e.address, e.city].filter(Boolean).join(", "));
  const dist = distanceFromFrankfurt(e.city);
  const endTime =
    e.ends_at && e.time_known
      ? new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }).format(new Date(e.ends_at))
      : null;

  return (
    <main className="px-4 pt-[max(env(safe-area-inset-top),1rem)]">
      <BackLink />

      <div className="flex gap-4 items-start mt-2">
        <DateTile startsAt={e.starts_at} city={e.city} size="lg" cancelled={cancelled} past={past} />
        <div className="min-w-0">
          {cancelled && <p className="text-danger font-bold mb-1">Dieses Event wurde abgesagt.</p>}
          {past && !cancelled && <p className="text-muted font-bold mb-1">Dieses Event ist vorbei.</p>}
          <h1 className={`font-display text-[1.75rem] leading-tight font-extrabold ${cancelled ? "line-through" : ""}`}>{e.title}</h1>
          {e.organizer && <p className="text-muted mt-1">{e.organizer}</p>}
        </div>
      </div>

      {e.summary && <p className="mt-5 text-lg leading-relaxed">{e.summary}</p>}

      <dl className="mt-5 rounded-2xl bg-card border border-line divide-y divide-line">
        <Row label="Wann">
          {formatWhen(e)}
          {endTime ? ` bis ${endTime} Uhr` : ""}
        </Row>
        {where && (
          <Row label="Wo">
            <a className="underline decoration-line underline-offset-4" href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noreferrer">
              {where}
            </a>
            {dist !== null && dist > 2 && <span className="text-muted"> ({dist} km von Frankfurt)</span>}
          </Row>
        )}
        {e.cost && <Row label="Kosten">{e.cost}</Row>}
        <Row label="Anmeldung">{e.registration === "ja" ? "Erforderlich" : e.registration === "nein" ? "Nicht nötig" : "Unklar, im Zweifel beim Veranstalter nachsehen"}</Row>
      </dl>

      <div className="mt-5 space-y-2">
        {e.registration_url && !cancelled && !past && (
          <a href={e.registration_url} target="_blank" rel="noreferrer" className="flex items-center justify-center h-12 rounded-xl bg-felt text-felt-ink font-bold text-lg">
            Zur Anmeldung
          </a>
        )}
        <div className="grid grid-cols-2 gap-2">
          <a href={`/api/events/${e.id}/ics`} className="flex items-center justify-center text-center px-2 h-11 rounded-xl border border-line bg-card text-sm font-bold">
            Zum Kalender hinzufügen
          </a>
          {e.source_url && (
            <a href={e.source_url} target="_blank" rel="noreferrer" className="flex items-center justify-center text-center px-2 h-11 rounded-xl border border-line bg-card text-sm font-bold">
              Originalquelle öffnen
            </a>
          )}
        </div>
      </div>

      {e.description && (
        <section className="mt-6">
          <h2 className="font-display text-lg font-bold mb-2">Beschreibung</h2>
          <p className="whitespace-pre-line leading-relaxed max-w-[65ch]">{e.description}</p>
        </section>
      )}

      <p className="mt-6 text-sm text-muted">
        Gefunden {sources.length ? `bei ${sources.map((s) => s.name).join(", ")}` : ""} am{" "}
        {new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", dateStyle: "medium" }).format(new Date(e.first_seen_at))}.
        {e.is_recurring ? " Regelmäßiger Termin." : ""} Angaben automatisch ausgelesen, vor dem Hingehen kurz beim Veranstalter prüfen.
      </p>
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-2 px-4 py-3">
      <dt className="text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
