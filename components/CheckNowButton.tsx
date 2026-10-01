"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface RunResult {
  sourcesOk: number;
  sourcesFailed: number;
  eventsNew: number;
  eventsChanged: number;
  notificationsSent: number;
  error?: string;
}

export function CheckNowButton({ variant = "icon" }: { variant?: "icon" | "full" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run(force: boolean) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/check-now${force ? "?force=1" : ""}`, { method: "POST" });
      const r = (await res.json()) as RunResult;
      if (!res.ok || r.error) throw new Error(r.error ?? `HTTP ${res.status}`);
      setMsg(
        `${r.eventsNew} neu, ${r.eventsChanged} geändert. ${r.sourcesOk} Quellen geprüft${r.sourcesFailed ? `, ${r.sourcesFailed} mit Fehler` : ""}.`,
      );
      router.refresh();
    } catch (e) {
      setMsg(`Prüfung fehlgeschlagen: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  if (variant === "icon") {
    return (
      <div className="relative">
        <button
          onClick={() => run(false)}
          disabled={busy}
          className="h-10 px-3 whitespace-nowrap rounded-full bg-felt text-felt-ink text-sm font-bold disabled:opacity-60 flex items-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className={busy ? "animate-spin" : ""} aria-hidden>
            <path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5" />
          </svg>
          {busy ? "Prüfe …" : "Jetzt prüfen"}
        </button>
        {msg && (
          <p role="status" className="absolute right-0 top-12 w-64 z-30 rounded-xl bg-ink text-paper text-sm p-3 shadow-lg" onClick={() => setMsg(null)}>
            {msg}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button onClick={() => run(false)} disabled={busy} className="flex-1 h-11 rounded-xl bg-felt text-felt-ink font-bold disabled:opacity-60">
          {busy ? "Prüfe …" : "Jetzt prüfen"}
        </button>
        <button onClick={() => run(true)} disabled={busy} className="h-11 px-4 rounded-xl border border-line text-sm disabled:opacity-60">
          Alle neu auswerten
        </button>
      </div>
      {msg && <p role="status" className="text-sm text-muted">{msg}</p>}
    </div>
  );
}
