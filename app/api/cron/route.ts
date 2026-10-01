import { NextResponse } from "next/server";
import { runCheck } from "@/lib/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Wird von Vercel Cron (siehe vercel.json) aufgerufen. Vercel sendet automatisch
 * „Authorization: Bearer <CRON_SECRET>“, wenn die Umgebungsvariable gesetzt ist.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
  try {
    const result = await runCheck("cron");
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
