import * as cheerio from "cheerio";
import type { Source } from "@/lib/db";
import { MAX_TEXT_CHARS, politeFetch, type RawDocument, type SourceAdapter } from "./types";
import { htmlToText } from "./website";

/** RSS/Atom-Feeds – z. B. Vereins-Blogs oder Social-Media-Feeds über eine RSS-Bridge. */
export const rssAdapter: SourceAdapter = {
  type: "rss",
  available: () => ({ ok: true }),
  async fetch(source: Source): Promise<RawDocument[]> {
    const res = await politeFetch(source.url, {
      headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" },
    });
    const $ = cheerio.load(await res.text(), { xml: true });
    const items: string[] = [];

    $("item, entry")
      .slice(0, 25)
      .each((_, el) => {
        const it = $(el);
        const link = it.find("link").attr("href") ?? it.find("link").first().text();
        const date = it.find("pubDate, published, updated").first().text();
        const body = it.find("content\\:encoded, content, description, summary").first().text();
        items.push(
          [
            `TITEL: ${it.find("title").first().text().trim()}`,
            date ? `VERÖFFENTLICHT: ${date}` : "",
            link ? `LINK: ${link.trim()}` : "",
            `INHALT: ${htmlToText(body, link || source.url).slice(0, 2000)}`,
          ]
            .filter(Boolean)
            .join("\n"),
        );
      });

    if (!items.length) return [];
    return [{ url: source.url, text: items.join("\n\n---\n\n").slice(0, MAX_TEXT_CHARS), kind: "RSS-/Atom-Feed (Beiträge mit Veröffentlichungsdatum)" }];
  },
};
