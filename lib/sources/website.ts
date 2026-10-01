import * as cheerio from "cheerio";
import type { Source } from "@/lib/db";
import { MAX_TEXT_CHARS, politeFetch, type RawDocument, type SourceAdapter } from "./types";
import { isAllowedByRobots } from "./robots";

/** Wandelt HTML in gut lesbaren Text um und behält Links als „Text [URL]“. */
export function htmlToText(html: string, baseUrl: string): string {
  const $ = cheerio.load(html);

  // Strukturierte Event-Daten (schema.org) sind Gold wert – zuerst einsammeln.
  const jsonLd: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text().trim();
    if (/"@type"\s*:\s*"?(Event|SocialEvent|EventSeries)/i.test(raw)) jsonLd.push(raw.slice(0, 8000));
  });

  $("script, style, noscript, svg, iframe, form, header nav, footer nav, [aria-hidden=true]").remove();

  $("a[href]").each((_, el) => {
    const a = $(el);
    const href = a.attr("href") ?? "";
    if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:")) return;
    let abs = href;
    try {
      abs = new URL(href, baseUrl).toString();
    } catch {
      return;
    }
    const label = a.text().replace(/\s+/g, " ").trim();
    a.replaceWith(label ? ` ${label} [${abs}] ` : ` [${abs}] `);
  });

  $("br").replaceWith("\n");
  $("p, div, li, h1, h2, h3, h4, h5, h6, tr, section, article").each((_, el) => {
    $(el).append("\n");
  });

  const root = $("main").length ? $("main") : $("body");
  const text = root
    .text()
    .replace(/[ \t ]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();

  const prefix = jsonLd.length ? `STRUKTURIERTE EVENT-DATEN (JSON-LD):\n${jsonLd.join("\n")}\n\nSEITENTEXT:\n` : "";
  return (prefix + text).slice(0, MAX_TEXT_CHARS);
}

export const websiteAdapter: SourceAdapter = {
  type: "website",
  available: () => ({ ok: true }),
  async fetch(source: Source): Promise<RawDocument[]> {
    if (!(await isAllowedByRobots(source.url))) {
      throw new Error("robots.txt erlaubt den Abruf dieser Seite nicht – Quelle bitte deaktivieren.");
    }
    const res = await politeFetch(source.url, { headers: { Accept: "text/html,application/xhtml+xml" } });
    const html = await res.text();
    return [{ url: source.url, text: htmlToText(html, res.url || source.url), kind: "Webseite" }];
  },
};
