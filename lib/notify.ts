import webpush from "web-push";
import { query, type EventRow, type Settings } from "@/lib/db";

/** Adresse der App für Links in Nachrichten. Auf Vercel automatisch ermittelt. */
export function appUrl(): string {
  const fromVercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  const url = process.env.APP_URL ?? (fromVercel ? `https://${fromVercel}` : "http://localhost:3000");
  return url.replace(/\/$/, "");
}

export function formatWhen(e: Pick<EventRow, "starts_at" | "time_known">): string {
  const d = new Date(e.starts_at);
  const opts: Intl.DateTimeFormatOptions = e.time_known
    ? { timeZone: "Europe/Berlin", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
    : { timeZone: "Europe/Berlin", weekday: "short", day: "numeric", month: "short" };
  return new Intl.DateTimeFormat("de-DE", opts).format(d) + (e.time_known ? " Uhr" : "");
}

const REASON_LABEL: Record<string, string> = { neu: "Neu", geaendert: "Geändert", abgesagt: "Abgesagt" };

function place(e: EventRow): string {
  return [e.venue, e.city].filter(Boolean).join(", ");
}

/** Liegt die aktuelle Berliner Uhrzeit in den stillen Zeiten? */
export function inQuietHours(s: Pick<Settings, "quiet_start" | "quiet_end">, now = new Date()): boolean {
  const hm = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return (h % 24) * 60 + (m || 0);
  };
  const cur = toMin(hm);
  const start = toMin(s.quiet_start);
  const end = toMin(s.quiet_end);
  if (start === end) return false;
  return start < end ? cur >= start && cur < end : cur >= start || cur < end;
}

// ───────────────────────── Web Push ─────────────────────────
let vapidReady = false;
function setupVapid(): boolean {
  if (vapidReady) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:admin@example.com", pub, priv);
  vapidReady = true;
  return true;
}

async function sendWebPush(payload: { title: string; body: string; url: string; tag: string }): Promise<number> {
  if (!setupVapid()) return 0;
  const subs = await query<{ id: string; endpoint: string; p256dh: string; auth: string }>("select * from push_subscriptions");
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 60 * 24 },
      );
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await query("delete from push_subscriptions where id = $1", [s.id]);
    }
  }
  return sent;
}

// ───────────────────────── Telegram ─────────────────────────
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function sendTelegram(html: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return false;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text: html, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  if (!res.ok) throw new Error(`Telegram: HTTP ${res.status} ${await res.text()}`);
  return true;
}

// ───────────────────────── ntfy ─────────────────────────
async function sendNtfy(title: string, message: string, click: string): Promise<boolean> {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return false;
  const server = (process.env.NTFY_SERVER ?? "https://ntfy.sh").replace(/\/$/, "");
  const res = await fetch(server, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.NTFY_TOKEN ? { Authorization: `Bearer ${process.env.NTFY_TOKEN}` } : {}),
    },
    body: JSON.stringify({ topic, title, message, click, tags: ["game_die"] }),
  });
  if (!res.ok) throw new Error(`ntfy: HTTP ${res.status}`);
  return true;
}

/**
 * Verschickt Benachrichtigungen für die übergebenen Events über alle aktivierten
 * Kanäle. Ab 4 Events wird gebündelt, damit das Handy nicht dauernd vibriert.
 * Gibt die Anzahl erfolgreich versendeter Nachrichten zurück.
 */
export async function notifyEvents(events: EventRow[], settings: Settings, log: (m: string) => void): Promise<number> {
  if (!events.length) return 0;
  let sent = 0;
  const base = appUrl();

  const pushItems =
    events.length > 3
      ? [
          {
            title: `🎲 ${events.length} neue Brettspiel-Events`,
            body: events
              .slice(0, 5)
              .map((e) => `${formatWhen(e)}: ${e.title}`)
              .join("\n"),
            url: `${base}/?neu=1`,
            tag: "sammel",
          },
        ]
      : events.map((e) => ({
          title: `${e.notify_reason === "abgesagt" ? "❌" : e.notify_reason === "geaendert" ? "✏️" : "🎲"} ${e.title}`,
          body: [`${formatWhen(e)}${place(e) ? ` · ${place(e)}` : ""}`, e.summary ?? ""].filter(Boolean).join("\n"),
          url: `${base}/events/${e.id}`,
          tag: e.id,
        }));

  if (settings.channel_webpush) {
    for (const p of pushItems) {
      try {
        sent += await sendWebPush(p);
      } catch (err) {
        log(`Web Push fehlgeschlagen: ${(err as Error).message}`);
      }
    }
  }

  if (settings.channel_telegram) {
    const html = events
      .map((e) => {
        const label = REASON_LABEL[e.notify_reason ?? "neu"];
        return [
          `<b>${label}: ${esc(e.title)}</b>`,
          `🗓 ${esc(formatWhen(e))}`,
          place(e) ? `📍 ${esc(place(e))}` : "",
          e.summary ? esc(e.summary) : "",
          e.registration === "ja" && e.registration_url ? `👉 <a href="${esc(e.registration_url)}">Zur Anmeldung</a>` : "",
          `<a href="${base}/events/${e.id}">Details in der App</a>`,
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n\n");
    try {
      if (await sendTelegram(html)) sent++;
    } catch (err) {
      log((err as Error).message);
    }
  }

  if (settings.channel_ntfy) {
    for (const p of pushItems) {
      try {
        if (await sendNtfy(p.title, p.body, p.url)) sent++;
      } catch (err) {
        log((err as Error).message);
      }
    }
  }

  return sent;
}

/** Testnachricht über alle konfigurierten Kanäle. */
export async function sendTestNotification(settings: Settings): Promise<string[]> {
  const results: string[] = [];
  const url = `${appUrl()}/`;
  if (settings.channel_webpush) {
    const n = await sendWebPush({ title: "🎲 Testnachricht", body: "Benachrichtigungen funktionieren.", url, tag: "test" }).catch(() => 0);
    results.push(n ? `Web Push: an ${n} Gerät(e) gesendet` : "Web Push: kein Gerät abonniert oder VAPID-Schlüssel fehlen");
  }
  if (settings.channel_telegram) {
    const ok = await sendTelegram("<b>🎲 Testnachricht</b>\nBenachrichtigungen funktionieren.").catch((e: Error) => e.message);
    results.push(ok === true ? "Telegram: gesendet" : ok === false ? "Telegram: Token/Chat-ID fehlen" : `Telegram: ${ok}`);
  }
  if (settings.channel_ntfy) {
    const ok = await sendNtfy("🎲 Testnachricht", "Benachrichtigungen funktionieren.", url).catch((e: Error) => e.message);
    results.push(ok === true ? "ntfy: gesendet" : ok === false ? "ntfy: NTFY_TOPIC fehlt" : `ntfy: ${ok}`);
  }
  return results;
}
