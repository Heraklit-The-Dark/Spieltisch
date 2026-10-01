import { authConfigured } from "@/lib/session";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ fehler?: string; next?: string }> }) {
  const sp = await searchParams;
  const configured = authConfigured();
  return (
    <main className="min-h-dvh flex flex-col justify-center px-6">
      <div className="flex gap-2 mb-6" aria-hidden>
        {["#C8372A", "#2C66B3", "#E2AE12", "#3A8F50"].map((c, i) => (
          <span key={c} className="tile w-10 h-10 rounded-lg" style={{ background: c, transform: `rotate(${[-6, 3, -2, 5][i]}deg)` }} />
        ))}
      </div>
      <h1 className="font-display text-4xl font-extrabold leading-none">Spieltisch</h1>
      <p className="text-muted mt-2">Brettspiel-Events in Frankfurt und Umgebung</p>

      {!configured ? (
        <p className="mt-8 rounded-xl border border-line bg-card p-4">
          Lege in Vercel unter „Environment Variables“ einen Eintrag mit dem Namen <code>APP_PASSWORD</code> und deinem Wunschpasswort an. Danach die App neu bereitstellen (Deployments → Redeploy).
        </p>
      ) : (
        <form action="/api/auth" method="post" className="mt-8 space-y-3">
          <input type="hidden" name="next" value={sp.next ?? "/"} />
          <label className="block">
            <span className="font-bold">Passwort</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              autoFocus
              className="mt-1 w-full h-12 rounded-xl border border-line bg-card px-4 text-lg"
            />
          </label>
          {sp.fehler && <p className="text-danger" role="alert">Das Passwort stimmt nicht. Bitte noch einmal versuchen.</p>}
          <button className="w-full h-12 rounded-xl bg-felt text-felt-ink font-bold text-lg">Anmelden</button>
        </form>
      )}
    </main>
  );
}
