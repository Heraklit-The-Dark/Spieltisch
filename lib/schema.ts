/**
 * Datenbankschema. Wird beim ersten Zugriff automatisch angelegt (idempotent),
 * ein SQL-Editor ist also nicht nötig. gen_random_uuid() ist ab PostgreSQL 13 eingebaut.
 */
export const SCHEMA_SQL = `-- ───────────────────────── Quellen ─────────────────────────
create table if not exists sources (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  -- website = normale Webseite, ical = Kalender-Feed (z. B. Meetup),
  -- rss = RSS/Atom-Feed (z. B. über RSS-Bridge), social = Instagram/Facebook via Apify
  type          text not null check (type in ('website', 'ical', 'rss', 'social')),
  url           text not null,
  city          text,
  notes         text,
  active        boolean not null default true,
  last_success_at timestamptz,
  last_error    text,
  last_error_at timestamptz,
  last_content_hash text,          -- Inhalt unverändert → LLM-Aufruf wird übersprungen
  created_at    timestamptz not null default now()
);

-- ───────────────────────── Events ─────────────────────────
create table if not exists events (
  id               uuid primary key default gen_random_uuid(),
  dedupe_key       text not null unique,      -- Hash aus normalisiertem Titel + Datum + Ort
  title            text not null,
  organizer        text,
  venue            text,
  address          text,
  city             text,
  starts_at        timestamptz not null,
  ends_at          timestamptz,
  time_known       boolean not null default true,
  summary          text,                       -- Kurzüberblick (1–2 Sätze)
  description      text,                       -- ausführliche Beschreibung
  cost             text,
  registration     text not null default 'unklar' check (registration in ('ja', 'nein', 'unklar')),
  registration_url text,
  source_url       text,
  source_ids       uuid[] not null default '{}',
  is_recurring     boolean not null default false,  -- regelmäßiger Stammtisch → keine Push
  is_novelty       boolean not null default false,  -- Neuheiten-/Premieren-Abend
  status           text not null default 'geplant' check (status in ('geplant', 'abgesagt')),
  content_hash     text,                       -- erkennt wesentliche Änderungen
  first_seen_at    timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  notify_pending   boolean not null default false,
  notify_reason    text,                       -- 'neu' | 'geaendert' | 'abgesagt'
  notified_at      timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists events_starts_at_idx on events (starts_at);
create index if not exists events_notify_idx on events (notify_pending) where notify_pending;

-- ───────────────────────── Push-Abos ─────────────────────────
create table if not exists push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

-- ───────────────────────── Lauf-Protokoll ─────────────────────────
create table if not exists run_logs (
  id            uuid primary key default gen_random_uuid(),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  trigger       text not null default 'cron',  -- cron | manuell | github
  sources_ok    int not null default 0,
  sources_failed int not null default 0,
  events_new    int not null default 0,
  events_changed int not null default 0,
  notifications_sent int not null default 0,
  log           jsonb not null default '[]'::jsonb
);

-- ───────────────────────── Einstellungen (eine Zeile) ─────────────────────────
create table if not exists settings (
  id                  int primary key default 1 check (id = 1),
  notifications_on    boolean not null default true,
  radius_km           int not null default 40,
  preferred_cities    text[] not null default '{}',
  quiet_start         text not null default '22:00',
  quiet_end           text not null default '08:00',
  notify_recurring    boolean not null default false,
  channel_webpush     boolean not null default true,
  channel_telegram    boolean not null default true,
  channel_ntfy        boolean not null default false,
  updated_at          timestamptz not null default now()
);
insert into settings (id) values (1) on conflict (id) do nothing;
`;

/** Startquellen – werden nur eingefügt, wenn die Quellen-Tabelle noch leer ist. */
export const SEED_SOURCES_SQL = `
insert into sources (name, type, url, city, active, notes) values
('T3 Terminal Entertainment', 'website', 'https://<website-eintragen>', 'Frankfurt', false,
   'Comics & Spiele, Große Eschenheimer Str. 41A. Website-URL prüfen und Event-Seite eintragen.'),
  ('Playce Spielecafé', 'website', 'https://<website-eintragen>', 'Frankfurt', false,
   'Spielecafé in Bockenheim, testet Neuheiten. Website-URL prüfen.'),
  ('Spielekreis Darmstadt / Spielezentrum', 'website', 'https://www.spielekreis-darmstadt.de', 'Darmstadt', true,
   'Spielezentrum/Ludothek, Rheinstraße 28.'),
  ('Darmstadt spielt', 'website', 'https://www.darmstadt-spielt.de', 'Darmstadt', true,
   'Größtes Spielefest Hessens.'),
  ('BGG-Gilde Frankfurt & Rhein/Main', 'website', 'https://boardgamegeek.com/guild/414', 'Frankfurt', true,
   'Wichtigste Sammelquelle, inkl. Gilden-Kalender.'),
  ('Meetup: The Kingmakers Table', 'ical', 'https://www.meetup.com/the-kingmakers-table/events/ical/', 'Frankfurt', true,
   'Meetup stellt pro Gruppe einen iCal-Feed bereit.'),
  ('Meetup: Frankfurt Board Games', 'ical', 'https://www.meetup.com/<gruppenname>/events/ical/', 'Frankfurt', false,
   'Gruppennamen aus der Meetup-URL einsetzen.'),
  ('Meetup: Frankfurt Game Lovers', 'ical', 'https://www.meetup.com/<gruppenname>/events/ical/', 'Frankfurt', false,
   'Gruppennamen aus der Meetup-URL einsetzen.'),
  ('Meetup: Darmstadt Board Games Group', 'ical', 'https://www.meetup.com/<gruppenname>/events/ical/', 'Darmstadt', false,
   'Gruppennamen aus der Meetup-URL einsetzen.'),
  ('Instagram: Spielkultur Frankfurt e.V.', 'social', 'https://www.instagram.com/spielkultur.frankfurt.ev/', 'Frankfurt', false,
   'Nur mit APIFY_TOKEN. Verein trifft sich dienstags, Absprache läuft über Discord.');
`;
