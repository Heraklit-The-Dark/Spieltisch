import postgres from "postgres";
import { SCHEMA_SQL, SEED_SOURCES_SQL } from "@/lib/schema";

export type SourceType = "website" | "ical" | "rss" | "social";

export interface Source {
  id: string;
  name: string;
  type: SourceType;
  url: string;
  city: string | null;
  notes: string | null;
  active: boolean;
  last_success_at: string | null;
  last_error: string | null;
  last_error_at: string | null;
  last_content_hash: string | null;
  created_at: string;
}

export interface EventRow {
  id: string;
  dedupe_key: string;
  title: string;
  organizer: string | null;
  venue: string | null;
  address: string | null;
  city: string | null;
  starts_at: string;
  ends_at: string | null;
  time_known: boolean;
  summary: string | null;
  description: string | null;
  cost: string | null;
  registration: "ja" | "nein" | "unklar";
  registration_url: string | null;
  source_url: string | null;
  source_ids: string[];
  is_recurring: boolean;
  is_novelty: boolean;
  status: "geplant" | "abgesagt";
  content_hash: string | null;
  first_seen_at: string;
  updated_at: string;
  notify_pending: boolean;
  notify_reason: "neu" | "geaendert" | "abgesagt" | null;
  notified_at: string | null;
}

export interface Settings {
  id: 1;
  notifications_on: boolean;
  radius_km: number;
  preferred_cities: string[];
  quiet_start: string;
  quiet_end: string;
  notify_recurring: boolean;
  channel_webpush: boolean;
  channel_telegram: boolean;
  channel_ntfy: boolean;
}

export interface RunLog {
  id: string;
  started_at: string;
  finished_at: string | null;
  trigger: string;
  sources_ok: number;
  sources_failed: number;
  events_new: number;
  events_changed: number;
  notifications_sent: number;
  log: string[];
}

/**
 * Verbindungsadresse der Datenbank. Die Neon-Integration von Vercel setzt
 * DATABASE_URL automatisch; POSTGRES_URL wird als Ausweichname akzeptiert.
 */
function connectionString(): string | undefined {
  return process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
}

export function isDbConfigured(): boolean {
  return Boolean(connectionString());
}

let client: postgres.Sql | null = null;
let schemaReady: Promise<void> | null = null;

function sql(): postgres.Sql {
  if (client) return client;
  const url = connectionString();
  if (!url) throw new Error("DATABASE_URL fehlt. In Vercel unter Storage die Neon-Datenbank mit dem Projekt verbinden (siehe README).");
  client = postgres(url, {
    max: 3, // Serverless: wenige Verbindungen pro Instanz
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false, // nötig für Neons Verbindungs-Pooler (PgBouncer)
    ssl: /localhost|127\.0\.0\.1/.test(url) ? false : "require",
    onnotice: () => {},
  });
  return client;
}

/** Legt Tabellen und Startquellen beim ersten Zugriff an. Läuft pro Server-Instanz nur einmal. */
function ensureSchema(): Promise<void> {
  schemaReady ??= sql()
    .begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(472911)`; // verhindert Wettlauf paralleler Kaltstarts
      await tx.unsafe(SCHEMA_SQL);
      const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from sources`;
      if (n === 0) await tx.unsafe(SEED_SOURCES_SQL);
    })
    .then(() => undefined)
    .catch((err) => {
      schemaReady = null; // beim nächsten Aufruf erneut versuchen
      throw err;
    });
  return schemaReady;
}

/** Datumswerte als ISO-Strings zurückgeben, damit Server und Client dieselben Typen sehen. */
function normalize<T>(row: Record<string, unknown>): T {
  for (const k of Object.keys(row)) {
    const v = row[k];
    if (v instanceof Date) row[k] = v.toISOString();
  }
  return row as T;
}

/** Parametrisierte Abfrage: Platzhalter $1, $2, … – Werte werden nie in den SQL-Text eingesetzt. */
export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  await ensureSchema();
  const rows = await sql().unsafe(text, params as postgres.ParameterOrJSON<never>[]);
  return rows.map((r) => normalize<T>(r as Record<string, unknown>));
}

export async function queryOne<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function getSettings(): Promise<Settings> {
  const s = await queryOne<Settings>("select * from settings where id = 1");
  if (!s) throw new Error("Einstellungen fehlen in der Datenbank.");
  return s;
}

type Table = "sources" | "events" | "push_subscriptions" | "run_logs" | "settings";
const ident = (name: string) => {
  if (!/^[a-z_]+$/.test(name)) throw new Error(`Ungültiger Spaltenname: ${name}`);
  return `"${name}"`;
};

/** Zeile einfügen und die gespeicherte Zeile zurückgeben. Spaltennamen kommen nur aus dem Code. */
export async function insertRow<T>(table: Table, values: Record<string, unknown>): Promise<T> {
  const cols = Object.keys(values);
  const text = `insert into ${table} (${cols.map(ident).join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning *`;
  const row = await queryOne<T>(text, cols.map((c) => values[c]));
  return row as T;
}

/** Zeile per id ändern und die neue Fassung zurückgeben. */
export async function updateRow<T>(table: Table, id: string | number, values: Record<string, unknown>): Promise<T | null> {
  const cols = Object.keys(values);
  if (!cols.length) return null;
  const text = `update ${table} set ${cols.map((c, i) => `${ident(c)} = $${i + 1}`).join(", ")} where id = $${cols.length + 1} returning *`;
  return queryOne<T>(text, [...cols.map((c) => values[c]), id]);
}

/** Für Skripte: Verbindung sauber schließen, damit der Prozess endet. */
export async function closeDb(): Promise<void> {
  await client?.end({ timeout: 5 });
  client = null;
  schemaReady = null;
}
