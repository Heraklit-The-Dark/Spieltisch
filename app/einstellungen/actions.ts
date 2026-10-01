"use server";

import { revalidatePath } from "next/cache";
import { updateRow } from "@/lib/db";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function saveSettings(form: FormData) {
  const radius = Math.min(150, Math.max(5, Number(form.get("radius_km") ?? 40)));
  const quietStart = String(form.get("quiet_start") ?? "22:00");
  const quietEnd = String(form.get("quiet_end") ?? "08:00");
  const preferred = form.getAll("preferred_cities").map(String).filter(Boolean);

  await updateRow("settings", 1, {
    notifications_on: form.get("notifications_on") === "on",
    notify_recurring: form.get("notify_recurring") === "on",
    radius_km: radius,
    preferred_cities: preferred,
    quiet_start: TIME.test(quietStart) ? quietStart : "22:00",
    quiet_end: TIME.test(quietEnd) ? quietEnd : "08:00",
    channel_webpush: form.get("channel_webpush") === "on",
    channel_telegram: form.get("channel_telegram") === "on",
    channel_ntfy: form.get("channel_ntfy") === "on",
    updated_at: new Date().toISOString(),
  });
  revalidatePath("/einstellungen");
}
