import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

const PUBLIC_PATHS = ["/login", "/api/auth", "/api/cron", "/manifest.webmanifest", "/sw.js", "/icons", "/offline"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();

  const ok = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (ok) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const target = pathname === "/" ? "/login" : `/login?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
  return new NextResponse(null, { status: 307, headers: { Location: target } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
