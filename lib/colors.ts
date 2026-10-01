/**
 * Jede Stadt bekommt eine „Spielerfarbe“ wie die Holzfiguren eines Brettspiels.
 * So erkennt man in der Liste auf einen Blick, wo ein Event stattfindet.
 */
const PLAYER: Record<string, { bg: string; fg: string; name: string }> = {
  frankfurt: { bg: "#C8372A", fg: "#FFFFFF", name: "Rot" },
  offenbach: { bg: "#2C66B3", fg: "#FFFFFF", name: "Blau" },
  darmstadt: { bg: "#E2AE12", fg: "#2A2205", name: "Gelb" },
  mainz: { bg: "#3A8F50", fg: "#FFFFFF", name: "Grün" },
  wiesbaden: { bg: "#7148A3", fg: "#FFFFFF", name: "Lila" },
  hanau: { bg: "#E07B24", fg: "#2A1605", name: "Orange" },
  "bad homburg": { bg: "#1F8C8C", fg: "#FFFFFF", name: "Türkis" },
};
const NEUTRAL = { bg: "#6B726C", fg: "#FFFFFF", name: "Grau" };

export function cityColor(city: string | null | undefined) {
  if (!city) return NEUTRAL;
  const c = city.toLowerCase();
  const hit = Object.entries(PLAYER).find(([k]) => c.includes(k));
  return hit ? hit[1] : NEUTRAL;
}
