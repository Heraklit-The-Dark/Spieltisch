/**
 * Einfacher Passwortschutz für die Einzelnutzer-App.
 * Das Cookie enthält eine HMAC-Signatur, die nur mit SESSION_SECRET erzeugt werden kann.
 * Nutzt Web Crypto, damit es auch in der Middleware (Edge-Runtime) läuft.
 */
export const SESSION_COOKIE = "st_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 180; // 180 Tage

async function hmac(message: string): Promise<string> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET fehlt.");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createSessionToken(): Promise<string> {
  const issued = Date.now().toString(36);
  return `${issued}.${await hmac(`spieltisch:${issued}`)}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token || !process.env.SESSION_SECRET) return false;
  const [issued, sig] = token.split(".");
  if (!issued || !sig) return false;
  const age = Date.now() - parseInt(issued, 36);
  if (!(age >= 0 && age < SESSION_MAX_AGE * 1000)) return false;
  const expected = await hmac(`spieltisch:${issued}`);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export function passwordMatches(input: string): boolean {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return false;
  if (input.length !== pw.length) return false;
  let diff = 0;
  for (let i = 0; i < pw.length; i++) diff |= pw.charCodeAt(i) ^ input.charCodeAt(i);
  return diff === 0;
}
