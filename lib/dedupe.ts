import { createHash } from "node:crypto";

const STOPWORDS = new Set(["der", "die", "das", "im", "in", "am", "an", "und", "mit", "für", "the", "at", "@", "a", "of", "bei", "zum", "zur"]);

export function sha(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 32);
}

export function normalizeText(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w))
    .join(" ");
}

/** Kalenderdatum (YYYY-MM-DD) in Berliner Zeit. */
export function berlinDate(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date(iso));
}

export function dedupeKey(title: string, startIso: string, place: string | null | undefined): string {
  return sha(`${normalizeText(title)}|${berlinDate(startIso)}|${normalizeText(place)}`);
}

/** Ähnlichkeit zweier Titel (Jaccard über Wörter), 0…1. */
export function titleSimilarity(a: string, b: string): number {
  const A = new Set(normalizeText(a).split(" ").filter(Boolean));
  const B = new Set(normalizeText(b).split(" ").filter(Boolean));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Fingerprint der Felder, deren Änderung eine Benachrichtigung rechtfertigt. */
export function contentHash(e: {
  starts_at: string;
  venue?: string | null;
  address?: string | null;
  status: string;
  registration_url?: string | null;
}): string {
  return sha([new Date(e.starts_at).toISOString(), normalizeText(e.venue), normalizeText(e.address), e.status, e.registration_url ?? ""].join("|"));
}
