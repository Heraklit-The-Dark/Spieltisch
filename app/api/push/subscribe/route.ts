import { NextResponse } from "next/server";
import { query } from "@/lib/db";

interface SubscriptionBody {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
}

export async function POST(req: Request) {
  const sub = (await req.json()) as SubscriptionBody;
  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json({ error: "Ungültiges Abo" }, { status: 400 });
  }
  try {
    await query(
      `insert into push_subscriptions (endpoint, p256dh, auth, user_agent) values ($1, $2, $3, $4)
       on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent`,
      [sub.endpoint, sub.keys.p256dh, sub.keys.auth, req.headers.get("user-agent")],
    );
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { endpoint } = (await req.json()) as { endpoint?: string };
  if (endpoint) await query("delete from push_subscriptions where endpoint = $1", [endpoint]);
  return NextResponse.json({ ok: true });
}
