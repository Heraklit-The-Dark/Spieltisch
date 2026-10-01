"use client";

import { useEffect, useState } from "react";

type State = "laden" | "nicht-unterstuetzt" | "ios-installieren" | "aus" | "an" | "blockiert";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function PushSetup({ vapidKey }: { vapidKey: string | null }) {
  const [state, setState] = useState<State>("laden");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const ua = navigator.userAgent;
      const isIOS = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && "ontouchend" in document);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
      if (isIOS && !standalone) return setState("ios-installieren");
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("nicht-unterstuetzt");
      if (Notification.permission === "denied") return setState("blockiert");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "an" : "aus");
    })();
  }, []);

  async function enable() {
    if (!vapidKey) return setMsg("Der öffentliche VAPID-Schlüssel fehlt in den Umgebungsvariablen.");
    setBusy(true);
    setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "blockiert" : "aus");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) });
      const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub) });
      if (!res.ok) throw new Error(`Server antwortet mit ${res.status}`);
      setState("an");
      setMsg("Benachrichtigungen auf diesem Gerät eingeschaltet.");
    } catch (e) {
      setMsg(`Einschalten fehlgeschlagen: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
    }
    setState("aus");
    setMsg("Benachrichtigungen auf diesem Gerät ausgeschaltet.");
    setBusy(false);
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <h2 className="font-display text-xl font-bold">Benachrichtigungen auf diesem Gerät</h2>
      {state === "laden" && <p className="text-muted mt-2">Wird geprüft …</p>}
      {state === "ios-installieren" && (
        <div className="mt-2 space-y-2">
          <p>Auf dem iPhone kommen Benachrichtigungen nur an, wenn die App auf dem Home-Bildschirm liegt (ab iOS 16.4).</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>In Safari unten auf das Teilen-Symbol tippen.</li>
            <li>„Zum Home-Bildschirm“ wählen und hinzufügen.</li>
            <li>Die App vom Home-Bildschirm öffnen und hier Benachrichtigungen einschalten.</li>
          </ol>
          <p className="text-sm text-muted">Bis dahin erreichen dich Meldungen über Telegram oder ntfy, falls eingerichtet.</p>
        </div>
      )}
      {state === "nicht-unterstuetzt" && <p className="mt-2">Dieser Browser unterstützt keine Web-Push-Benachrichtigungen. Nutze Telegram oder ntfy als Kanal.</p>}
      {state === "blockiert" && <p className="mt-2">Benachrichtigungen sind für diese Seite blockiert. Erlaube sie in den Browser- bzw. Systemeinstellungen und lade die Seite neu.</p>}
      {state === "aus" && (
        <button onClick={enable} disabled={busy} className="mt-3 w-full h-11 rounded-xl bg-felt text-felt-ink font-bold disabled:opacity-60">
          Benachrichtigungen einschalten
        </button>
      )}
      {state === "an" && (
        <div className="mt-2 flex items-center justify-between gap-3">
          <p>Eingeschaltet.</p>
          <button onClick={disable} disabled={busy} className="h-10 px-3 rounded-lg border border-line text-sm">
            Ausschalten
          </button>
        </div>
      )}
      {msg && <p role="status" className="text-sm text-muted mt-2">{msg}</p>}
    </div>
  );
}
