import { NextResponse } from "next/server";
import { runCheck } from "@/lib/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Wird von Vercel Cron (siehe vercel.json) aufgerufen.
 * Mit CRON_SECRET prüft die App den von Vercel mitgesendeten Schlüssel.
 * Ohne CRON_SECRET wird der Aufruf am Absender „vercel-cron“ erkannt. Das ist
 * weniger streng, ein Fremdaufruf könnte aber höchstens einen zusätzlichen Prüflauf auslösen.
 */
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret) return req.headers.get("authorization") === `Bearer ${secret}`;
  return (req.headers.get("user-agent") ?? "").toLowerCase().includes("vercel-cron");
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
  try {
    const result = await runCheck("cron");
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
