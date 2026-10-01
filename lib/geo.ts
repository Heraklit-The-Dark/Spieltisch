/** Grobe Koordinaten der Orte im Rhein-Main-Gebiet für den Umkreis-Filter. */
const FRANKFURT = { lat: 50.1109, lon: 8.6821 };

const CITIES: Record<string, { lat: number; lon: number }> = {
  frankfurt: FRANKFURT,
  offenbach: { lat: 50.0956, lon: 8.7761 },
  darmstadt: { lat: 49.8728, lon: 8.6512 },
  wiesbaden: { lat: 50.0782, lon: 8.2398 },
  mainz: { lat: 49.9929, lon: 8.2473 },
  hanau: { lat: 50.1264, lon: 8.9283 },
  "bad homburg": { lat: 50.2268, lon: 8.6182 },
  oberursel: { lat: 50.201, lon: 8.577 },
  "bad vilbel": { lat: 50.1786, lon: 8.7366 },
  eschborn: { lat: 50.1431, lon: 8.5701 },
  "neu-isenburg": { lat: 50.0531, lon: 8.6942 },
  dreieich: { lat: 50.0189, lon: 8.695 },
  langen: { lat: 49.9894, lon: 8.6656 },
  "rüsselsheim": { lat: 49.9958, lon: 8.4119 },
  friedberg: { lat: 50.3353, lon: 8.755 },
  hofheim: { lat: 50.0902, lon: 8.4458 },
  kronberg: { lat: 50.1797, lon: 8.5089 },
  "königstein": { lat: 50.1803, lon: 8.4636 },
  maintal: { lat: 50.15, lon: 8.8333 },
  rodgau: { lat: 50.0167, lon: 8.8833 },
  dietzenbach: { lat: 50.0086, lon: 8.7775 },
  "mühlheim": { lat: 50.1167, lon: 8.8333 },
  hainburg: { lat: 50.0833, lon: 8.9333 },
  seligenstadt: { lat: 50.0441, lon: 8.9753 },
  aschaffenburg: { lat: 49.9769, lon: 9.152 },
  weiterstadt: { lat: 49.9033, lon: 8.5878 },
  karben: { lat: 50.2322, lon: 8.7706 },
  "bad soden": { lat: 50.1431, lon: 8.5047 },
  kelkheim: { lat: 50.1381, lon: 8.4497 },
  "gießen": { lat: 50.584, lon: 8.6784 },
};

export const KNOWN_CITIES = Object.keys(CITIES)
  .map((c) => c.replace(/(^|[\s-])\S/g, (m) => m.toUpperCase()))
  .sort();

function normalizeCity(city: string): string {
  return city
    .toLowerCase()
    .replace(/\bam main\b|\(main\)|\bv\.d\.h\.|\bvor der höhe\b|\bim taunus\b|\ba\.\s?m\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Entfernung von Frankfurt in km, oder null wenn der Ort unbekannt ist. */
export function distanceFromFrankfurt(city: string | null | undefined): number | null {
  if (!city) return null;
  const n = normalizeCity(city);
  const hit = CITIES[n] ?? Object.entries(CITIES).find(([k]) => n.includes(k))?.[1];
  return hit ? Math.round(haversineKm(FRANKFURT, hit)) : null;
}

export function cityMatches(city: string | null | undefined, preferred: string[]): boolean {
  if (!preferred.length) return true;
  if (!city) return false;
  const n = normalizeCity(city);
  return preferred.some((p) => n.includes(normalizeCity(p)));
}
