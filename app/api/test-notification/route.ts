import { NextResponse } from "next/server";
import { getSettings } from "@/lib/db";
import { sendTestNotification } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const results = await sendTestNotification(await getSettings());
    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
