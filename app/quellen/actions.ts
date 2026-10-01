"use server";

import { revalidatePath } from "next/cache";
import { insertRow, query, updateRow, type SourceType } from "@/lib/db";

const TYPES: SourceType[] = ["website", "ical", "rss", "social"];

function cleanUrl(raw: string): string {
  const url = raw.trim();
  const parsed = new URL(url); // wirft bei ungültiger URL
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Nur http(s)-Adressen sind erlaubt.");
  return url;
}

export async function addSource(form: FormData) {
  const name = String(form.get("name") ?? "").trim();
  const type = String(form.get("type") ?? "website") as SourceType;
  const city = String(form.get("city") ?? "").trim() || null;
  if (!name || !TYPES.includes(type)) return;
  await insertRow("sources", { name, type, url: cleanUrl(String(form.get("url") ?? "")), city, active: true });
  revalidatePath("/quellen");
}

export async function updateSource(form: FormData) {
  const id = String(form.get("id"));
  const url = cleanUrl(String(form.get("url") ?? ""));
  // Neue URL → Inhalts-Hash zurücksetzen und als Erstimport behandeln (keine Benachrichtigungsflut).
  await updateRow("sources", id, { url, last_content_hash: null, last_success_at: null, last_error: null });
  revalidatePath("/quellen");
}

export async function toggleSource(form: FormData) {
  const id = String(form.get("id"));
  const active = form.get("active") === "true";
  await updateRow("sources", id, { active: !active });
  revalidatePath("/quellen");
}

export async function deleteSource(form: FormData) {
  await query("delete from sources where id = $1", [String(form.get("id"))]);
  revalidatePath("/quellen");
}
