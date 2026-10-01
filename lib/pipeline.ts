import { getSettings, insertRow, query, queryOne, updateRow, type EventRow, type Settings, type Source } from "@/lib/db";
import { adapters } from "@/lib/sources";
import { extractEvents, type ExtractedEvent } from "@/lib/extract";
import { berlinDate, contentHash, dedupeKey, normalizeText, sha, titleSimilarity } from "@/lib/dedupe";
import { cityMatches, distanceFromFrankfurt } from "@/lib/geo";
import { inQuietHours, notifyEvents } from "@/lib/notify";

export interface RunResult {
  runId: string | null;
  sourcesOk: number;
  sourcesFailed: number;
  eventsNew: number;
  eventsChanged: number;
  notificationsSent: number;
  log: string[];
}

const SKIP_UNCHANGED_FOR_MS = 6 * 24 * 3600 * 1000;

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(size, queue.length) }, async () => {
      while (queue.length) await fn(queue.shift()!);
    }),
  );
}

export function shouldNotifyNew(
  e: Pick<EventRow, "city" | "is_recurring" | "is_novelty" | "status">,
  settings: Settings,
): boolean {
  if (e.status !== "geplant") return false;
  const dist = distanceFromFrankfurt(e.city);
  if (dist !== null && dist > settings.radius_km) return false;
  if (!cityMatches(e.city, settings.preferred_cities)) return false;
  if (e.is_recurring && !e.is_novelty && !settings.notify_recurring) return false;
  return true;
}

function inArea(e: Pick<EventRow, "city">, settings: Settings): boolean {
  const dist = distanceFromFrankfurt(e.city);
  return (dist === null || dist <= settings.radius_km) && cityMatches(e.city, settings.preferred_cities);
}

/**
 * Ein kompletter Prüflauf: alle aktiven Quellen abrufen, Events extrahieren,
 * Duplikate zusammenführen, Änderungen erkennen, Benachrichtigungen senden.
 * Fehler einzelner Quellen brechen den Lauf nie ab.
 */
export async function runCheck(trigger: "cron" | "manuell" | "github", opts: { force?: boolean } = {}): Promise<RunResult> {
  const logLines: string[] = [];
  const log = (m: string) => {
    logLines.push(`${new Date().toISOString().slice(11, 19)} ${m}`);
    console.log(`[spieltisch] ${m}`);
  };
  const result: RunResult = { runId: null, sourcesOk: 0, sourcesFailed: 0, eventsNew: 0, eventsChanged: 0, notificationsSent: 0, log: logLines };

  const run = await queryOne<{ id: string }>("insert into run_logs (trigger) values ($1) returning id", [trigger]);
  result.runId = run?.id ?? null;

  const settings = await getSettings();
  const sources = await query<Source>("select * from sources where active order by name");
  log(`${sources.length} aktive Quellen`);

  // Bekannte Events der letzten 60 Tage und der Zukunft in den Speicher laden (kleine Datenmenge).
  const since = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
  const events = await query<EventRow>("select * from events where starts_at >= $1", [since]);
  const byKey = new Map(events.map((e) => [e.dedupe_key, e]));

  const findExisting = (key: string, ex: ExtractedEvent, startsAt: string): EventRow | undefined => {
    const hit = byKey.get(key);
    if (hit) return hit;
    const day = berlinDate(startsAt);
    return events.find(
      (e) =>
        berlinDate(e.starts_at) === day &&
        titleSimilarity(e.title, ex.title) >= 0.6 &&
        (!e.city || !ex.city || normalizeText(e.city) === normalizeText(ex.city)),
    );
  };

  const looksRecurring = (ex: ExtractedEvent, startsAt: string): boolean => {
    const day = berlinDate(startsAt);
    return events.some(
      (e) => berlinDate(e.starts_at) !== day && titleSimilarity(e.title, ex.title) >= 0.8 && normalizeText(e.city) === normalizeText(ex.city),
    );
  };

  await pool(sources, 3, async (source) => {
    const adapter = adapters[source.type];
    const ready = adapter?.available();
    if (!adapter || !ready?.ok) {
      log(`⏭ ${source.name}: übersprungen (${ready && !ready.ok ? ready.reason : "unbekannter Typ"})`);
      return;
    }
    // Erster erfolgreicher Abruf einer Quelle = Erstimport → still speichern, nicht benachrichtigen.
    const silent = !source.last_success_at;

    try {
      const docs = await adapter.fetch(source);
      const hash = sha(docs.map((d) => d.text).join("\n"));
      const recentlyChecked = source.last_success_at && Date.now() - Date.parse(source.last_success_at) < SKIP_UNCHANGED_FOR_MS;

      if (!opts.force && hash === source.last_content_hash && recentlyChecked) {
        log(`= ${source.name}: unverändert`);
        await updateRow("sources", source.id, { last_success_at: new Date().toISOString(), last_error: null });
        result.sourcesOk++;
        return;
      }

      let found = 0;
      for (const doc of docs) {
        const { events: extracted, dropped } = await extractEvents(doc, source.name, source.city);
        if (dropped) log(`⚠ ${source.name}: ${dropped} unvollständige Einträge verworfen`);

        for (const ex of extracted) {
          const startsAt = new Date(ex.start).toISOString();
          if (Date.parse(startsAt) < Date.now() - 3 * 3600 * 1000) continue; // vergangen
          found++;

          const key = dedupeKey(ex.title, startsAt, ex.venue ?? ex.city);
          const existing = findExisting(key, ex, startsAt);
          const fields = {
            title: ex.title,
            organizer: ex.organizer ?? null,
            venue: ex.venue ?? null,
            address: ex.address ?? null,
            city: ex.city ?? null,
            starts_at: startsAt,
            ends_at: ex.end && !Number.isNaN(Date.parse(ex.end)) ? new Date(ex.end).toISOString() : null,
            time_known: ex.time_known,
            summary: ex.summary ?? null,
            description: ex.description ?? null,
            cost: ex.cost ?? null,
            registration: ex.registration,
            registration_url: ex.registration_url ?? (ex.registration === "ja" ? ex.event_url ?? null : null),
            source_url: ex.event_url ?? doc.url,
            is_recurring: ex.is_recurring || looksRecurring(ex, startsAt),
            is_novelty: ex.is_novelty,
            status: ex.status,
          };

          if (!existing) {
            const notify = !silent && shouldNotifyNew(fields, settings);
            const row = {
              ...fields,
              dedupe_key: key,
              source_ids: [source.id],
              content_hash: contentHash(fields),
              notify_pending: notify,
              notify_reason: notify ? "neu" : null,
            };
            let saved: EventRow;
            try {
              saved = await insertRow<EventRow>("events", row);
            } catch (err) {
              log(`✗ ${source.name}: Event „${ex.title}“ nicht gespeichert: ${(err as Error).message}`);
              continue;
            }
            events.push(saved);
            byKey.set(key, saved);
            result.eventsNew++;
            continue;
          }

          // Bestehendes Event: Felder zusammenführen (vorhandene Infos nicht mit null überschreiben).
          const merged = {
            organizer: existing.organizer ?? fields.organizer,
            venue: existing.venue ?? fields.venue,
            address: existing.address ?? fields.address,
            city: existing.city ?? fields.city,
            summary: existing.summary ?? fields.summary,
            description:
              (fields.description?.length ?? 0) > (existing.description?.length ?? 0) ? fields.description : existing.description,
            cost: existing.cost ?? fields.cost,
            registration: existing.registration === "unklar" ? fields.registration : existing.registration,
            registration_url: existing.registration_url ?? fields.registration_url,
            is_recurring: existing.is_recurring || fields.is_recurring,
            is_novelty: existing.is_novelty || fields.is_novelty,
            source_ids: Array.from(new Set([...existing.source_ids, source.id])),
          };

          // Wesentliche Änderungen: Absage oder Zeitverschiebung > 15 Minuten (nur aus derselben Quelle,
          // damit leicht abweichende Angaben verschiedener Quellen keinen Fehlalarm auslösen).
          const sameSource = existing.source_ids.includes(source.id);
          const cancelled = sameSource && fields.status === "abgesagt" && existing.status !== "abgesagt";
          const moved =
            sameSource && fields.time_known && Math.abs(Date.parse(fields.starts_at) - Date.parse(existing.starts_at)) > 15 * 60 * 1000;

          const update: Record<string, unknown> = { ...merged, updated_at: new Date().toISOString() };
          if (cancelled || moved) {
            update.status = fields.status;
            update.starts_at = fields.starts_at;
            update.ends_at = fields.ends_at;
            update.content_hash = contentHash({ ...existing, ...fields });
            if (!silent && inArea({ city: merged.city }, settings)) {
              update.notify_pending = true;
              update.notify_reason = cancelled ? "abgesagt" : "geaendert";
            }
            result.eventsChanged++;
          }
          const saved = await updateRow<EventRow>("events", existing.id, update);
          if (saved) Object.assign(existing, saved);
        }
      }

      await updateRow("sources", source.id, { last_success_at: new Date().toISOString(), last_error: null, last_content_hash: hash });
      result.sourcesOk++;
      log(`✓ ${source.name}: ${found} Events gefunden${silent ? " (Erstimport, ohne Benachrichtigung)" : ""}`);
    } catch (err) {
      result.sourcesFailed++;
      const message = (err as Error).message.slice(0, 500);
      log(`✗ ${source.name}: ${message}`);
      await updateRow("sources", source.id, { last_error: message, last_error_at: new Date().toISOString() }).catch(() => null);
    }
  });

  // ───── Benachrichtigungen ─────
  const pendingEvents = await query<EventRow>(
    "select * from events where notify_pending and starts_at >= now() order by starts_at",
  );
  const pendingIds = pendingEvents.map((e) => e.id);

  if (pendingEvents.length) {
    if (!settings.notifications_on) {
      log(`Benachrichtigungen sind aus – ${pendingEvents.length} Events still gespeichert`);
      await query("update events set notify_pending = false where id = any($1::uuid[])", [pendingIds]);
    } else if (inQuietHours(settings)) {
      log(`Stille Zeit – ${pendingEvents.length} Benachrichtigungen werden beim nächsten Lauf gesendet`);
    } else {
      result.notificationsSent = await notifyEvents(pendingEvents, settings, log);
      await query("update events set notify_pending = false, notified_at = now() where id = any($1::uuid[])", [pendingIds]);
      log(`${pendingEvents.length} Events gemeldet, ${result.notificationsSent} Nachrichten versendet`);
    }
  }

  if (result.runId) {
    await updateRow("run_logs", result.runId, {
      finished_at: new Date().toISOString(),
      sources_ok: result.sourcesOk,
      sources_failed: result.sourcesFailed,
      events_new: result.eventsNew,
      events_changed: result.eventsChanged,
      notifications_sent: result.notificationsSent,
      log: logLines, // jsonb: der Treiber serialisiert selbst
    });
  }
  return result;
}
