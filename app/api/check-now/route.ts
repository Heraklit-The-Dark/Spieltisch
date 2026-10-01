import { NextResponse } from "next/server";
import { runCheck } from "@/lib/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** „Jetzt prüfen“-Button. Mit ?force=1 werden auch unveränderte Quellen neu ausgewertet. */
export async function POST(req: Request) {
  const force = new URL(req.url).searchParams.get("force") === "1";
  try {
    const result = await runCheck("manuell", { force });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
