import { USER_AGENT } from "./types";

/**
 * Minimaler robots.txt-Prüfer: wertet die Gruppen für unseren User-Agent bzw. „*“
 * aus (Allow/Disallow mit Präfix-Abgleich, längste Regel gewinnt).
 * Ist robots.txt nicht erreichbar, gilt der Abruf als erlaubt.
 */
const cache = new Map<string, { allow: string[]; disallow: string[] }>();

async function rulesFor(origin: string) {
  if (cache.has(origin)) return cache.get(origin)!;
  let rules = { allow: [] as string[], disallow: [] as string[] };
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(8_000),
    });
    if (res.ok) rules = parse(await res.text());
  } catch {
    /* nicht erreichbar → erlaubt */
  }
  cache.set(origin, rules);
  return rules;
}

function parse(txt: string) {
  const ourAgent = USER_AGENT.split("/")[0].toLowerCase();
  const groups: { agents: string[]; allow: string[]; disallow: string[] }[] = [];
  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;

  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], allow: [], disallow: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === "allow" && value) current.allow.push(value);
    if (key === "disallow" && value) current.disallow.push(value);
  }

  const specific = groups.find((g) => g.agents.some((a) => a !== "*" && ourAgent.includes(a)));
  const generic = groups.find((g) => g.agents.includes("*"));
  const g = specific ?? generic;
  return { allow: g?.allow ?? [], disallow: g?.disallow ?? [] };
}

function matches(path: string, rule: string): boolean {
  const pattern = "^" + rule.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$");
  return new RegExp(pattern).test(path);
}

export async function isAllowedByRobots(url: string): Promise<boolean> {
  const u = new URL(url);
  const { allow, disallow } = await rulesFor(u.origin);
  const path = u.pathname + u.search;
  const longest = (list: string[]) =>
    list.filter((r) => matches(path, r)).reduce((m, r) => Math.max(m, r.length), -1);
  const a = longest(allow);
  const d = longest(disallow);
  return d < 0 || a >= d;
}
