"use client";

import { useState } from "react";

export function TestNotificationButton() {
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  async function run() {
    setBusy(true);
    try {
      const res = await fetch("/api/test-notification", { method: "POST" });
      const data = (await res.json()) as { results?: string[]; error?: string };
      setLines(data.results?.length ? data.results : [data.error ?? "Kein Kanal eingeschaltet."]);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button onClick={run} disabled={busy} className="w-full h-11 rounded-xl border border-line bg-card font-bold disabled:opacity-60">
        {busy ? "Sende …" : "Testnachricht senden"}
      </button>
      {lines.length > 0 && (
        <ul role="status" className="text-sm text-muted mt-2 space-y-0.5">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function LogoutButton() {
  return (
    <button
      onClick={async () => {
        await fetch("/api/auth", { method: "DELETE" });
        window.location.href = "/login";
      }}
      className="text-sm text-muted underline underline-offset-4"
    >
      Abmelden
    </button>
  );
}
