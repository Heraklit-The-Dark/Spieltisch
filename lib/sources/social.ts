import type { Source } from "@/lib/db";
import { MAX_TEXT_CHARS, type RawDocument, type SourceAdapter } from "./types";

/**
 * Social-Media-Modul (optional, austauschbar).
 *
 * Instagram und Facebook lassen sich nicht direkt zuverlässig auslesen. Dieses Modul
 * nutzt daher einen Drittanbieter (Apify). Ohne APIFY_TOKEN ist es inaktiv und
 * Social-Quellen werden übersprungen – der restliche Lauf funktioniert normal.
 *
 * Hinweis: Das automatisierte Auslesen kann gegen die Nutzungsbedingungen der
 * Plattformen verstoßen und bricht gelegentlich. Alternativ eine RSS-Bridge
 * betreiben und die Quelle als Typ „rss“ anlegen.
 */
const INSTAGRAM_ACTOR = process.env.APIFY_INSTAGRAM_ACTOR ?? "apify~instagram-post-scraper";
const FACEBOOK_ACTOR = process.env.APIFY_FACEBOOK_ACTOR ?? "apify~facebook-posts-scraper";

interface ApifyPost {
  caption?: string;
  text?: string;
  timestamp?: string;
  time?: string;
  url?: string;
  postUrl?: string;
  locationName?: string;
}

function buildRequest(url: string): { actor: string; input: Record<string, unknown> } {
  const u = new URL(url);
  if (u.hostname.includes("instagram.com")) {
    const username = u.pathname.split("/").filter(Boolean)[0];
    return { actor: INSTAGRAM_ACTOR, input: { username: [username], resultsLimit: 12 } };
  }
  if (u.hostname.includes("facebook.com")) {
    return { actor: FACEBOOK_ACTOR, input: { startUrls: [{ url }], resultsLimit: 12 } };
  }
  throw new Error(`Social-Quelle nicht unterstützt: ${u.hostname} (nur Instagram/Facebook).`);
}

export const socialAdapter: SourceAdapter = {
  type: "social",
  available: () =>
    process.env.APIFY_TOKEN ? { ok: true } : { ok: false, reason: "APIFY_TOKEN fehlt – Social-Media-Modul ist deaktiviert." },
  async fetch(source: Source): Promise<RawDocument[]> {
    const { actor, input } = buildRequest(source.url);
    const endpoint = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${process.env.APIFY_TOKEN}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) throw new Error(`Apify antwortet mit HTTP ${res.status}`);
    const posts = (await res.json()) as ApifyPost[];

    const blocks = posts.slice(0, 15).map((p) =>
      [
        `VERÖFFENTLICHT: ${p.timestamp ?? p.time ?? "unbekannt"}`,
        p.url || p.postUrl ? `LINK: ${p.url ?? p.postUrl}` : "",
        p.locationName ? `ORT-TAG: ${p.locationName}` : "",
        `TEXT: ${(p.caption ?? p.text ?? "").slice(0, 2000)}`,
      ]
        .filter(Boolean)
        .join("\n"),
    );
    if (!blocks.length) return [];
    return [{ url: source.url, text: blocks.join("\n\n---\n\n").slice(0, MAX_TEXT_CHARS), kind: "Social-Media-Beiträge (Veröffentlichungsdatum ≠ Eventdatum!)" }];
  },
};
