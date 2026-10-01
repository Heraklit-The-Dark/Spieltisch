import type { Source } from "@/lib/db";
import type { ExtractedEvent } from "@/lib/extract";

/** Rohinhalt einer Quelle, der anschließend in Events umgewandelt wird. */
export interface RawDocument {
  url: string;
  /** Aufbereiteter Text inkl. Links im Format „Linktext [URL]“. */
  text: string;
  /** Kurze Angabe zur Art des Inhalts, hilft beim Einordnen. */
  kind: string;
  /**
   * Bereits strukturiert vorliegende Events (Kalender-Feed, schema.org-Daten der Website).
   * Sind sie vorhanden, wird keine KI gebraucht.
   */
  events?: ExtractedEvent[];
}

/**
 * Gemeinsame Schnittstelle aller Quellen. Neue Quellenarten (z. B. ein anderer
 * Social-Media-Dienst) werden hier ergänzt, ohne die Pipeline anzufassen.
 */
export interface SourceAdapter {
  type: Source["type"];
  /** Ist der Adapter einsatzbereit (z. B. API-Token vorhanden)? Sonst wird die Quelle übersprungen. */
  available(): { ok: true } | { ok: false; reason: string };
  fetch(source: Source): Promise<RawDocument[]>;
}

export const USER_AGENT =
  process.env.SCRAPER_USER_AGENT ??
  "SpieltischRheinMain/1.0 (privater Event-Benachrichtiger; einmal täglich)";

export const MAX_TEXT_CHARS = 30_000;

export async function politeFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "de-DE,de;q=0.9,en;q=0.6", ...(init.headers ?? {}) },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} bei ${url}`);
  return res;
}
