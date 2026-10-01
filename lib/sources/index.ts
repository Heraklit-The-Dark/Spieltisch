import type { SourceType } from "@/lib/db";
import type { SourceAdapter } from "./types";
import { websiteAdapter } from "./website";
import { icalAdapter } from "./ical";
import { rssAdapter } from "./rss";
import { socialAdapter } from "./social";

export const adapters: Record<SourceType, SourceAdapter> = {
  website: websiteAdapter,
  ical: icalAdapter,
  rss: rssAdapter,
  social: socialAdapter,
};

export type { RawDocument, SourceAdapter } from "./types";
