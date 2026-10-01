import { createSessionToken, passwordMatches, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";

/** Weiterleitung mit relativer Adresse – bleibt so immer auf dem Host, den der Browser nutzt. */
function redirect(path: string, cookie?: string): Response {
  const headers = new Headers({ Location: path });
  if (cookie) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 303, headers });
}

/** Login per Formular-POST. */
export async function POST(req: Request) {
  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  const nextRaw = String(form.get("next") ?? "/");
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/";

  if (!passwordMatches(password)) {
    return redirect(`/login?fehler=1&next=${encodeURIComponent(next)}`);
  }
  const secure = new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  const cookie = [
    `${SESSION_COOKIE}=${await createSessionToken()}`,
    "Path=/",
    `Max-Age=${SESSION_MAX_AGE}`,
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
  return redirect(next, cookie);
}

/** Logout. */
export async function DELETE() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
    },
  });
}
