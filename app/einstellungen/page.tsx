import { getSettings, isDbConfigured } from "@/lib/db";
import { SetupNotice } from "@/components/SetupNotice";
import { PushSetup } from "@/components/PushSetup";
import { LogoutButton, TestNotificationButton } from "@/components/TestAndLogout";
import { RadiusField } from "@/components/RadiusField";
import { saveSettings } from "./actions";

export const dynamic = "force-dynamic";

const CITY_OPTIONS = ["Frankfurt", "Offenbach", "Darmstadt", "Mainz", "Wiesbaden", "Hanau", "Bad Homburg", "Oberursel", "Bad Vilbel", "Neu-Isenburg"];

export default async function SettingsPage() {
  if (!isDbConfigured()) return <SetupNotice />;
  const s = await getSettings();
  const telegramReady = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
  const ntfyReady = Boolean(process.env.NTFY_TOPIC);

  return (
    <main className="px-4 pt-[max(env(safe-area-inset-top),1rem)] space-y-5">
      <h1 className="font-display text-[2rem] leading-none font-extrabold">Einstellungen</h1>

      <PushSetup vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />

      <form action={saveSettings} className="rounded-2xl border border-line bg-card p-4 space-y-5">
        <h2 className="font-display text-xl font-bold">Wann melden?</h2>

        <Toggle name="notifications_on" checked={s.notifications_on} label="Benachrichtigungen senden" hint="Aus: Events werden weiter gesammelt, aber nicht gemeldet." />
        <Toggle
          name="notify_recurring"
          checked={s.notify_recurring}
          label="Auch regelmäßige Termine melden"
          hint="Aus: Wöchentliche Stammtische melden sich nicht jede Woche neu. Neuheiten-Abende, Turniere und Absagen kommen trotzdem."
        />

        <RadiusField initial={s.radius_km} />

        <fieldset>
          <legend className="font-bold">Nur diese Orte</legend>
          <p className="text-sm text-muted">Nichts ausgewählt bedeutet: alle Orte im Umkreis.</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {CITY_OPTIONS.map((c) => (
              <label key={c} className="inline-flex items-center gap-2 h-9 px-3 rounded-full border border-line has-[:checked]:bg-ink has-[:checked]:text-paper has-[:checked]:border-ink cursor-pointer">
                <input type="checkbox" name="preferred_cities" value={c} defaultChecked={s.preferred_cities.includes(c)} className="sr-only" />
                {c}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="font-bold">Stille Zeiten</legend>
          <p className="text-sm text-muted">In diesem Zeitraum werden Meldungen zurückgehalten und beim nächsten Lauf gesendet.</p>
          <div className="flex items-center gap-2 mt-2">
            <input type="time" name="quiet_start" defaultValue={s.quiet_start} aria-label="Beginn" className="h-10 rounded-lg border border-line bg-paper px-2" />
            <span>bis</span>
            <input type="time" name="quiet_end" defaultValue={s.quiet_end} aria-label="Ende" className="h-10 rounded-lg border border-line bg-paper px-2" />
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="font-bold mb-1">Kanäle</legend>
          <Toggle name="channel_webpush" checked={s.channel_webpush} label="Push in der App" />
          <Toggle name="channel_telegram" checked={s.channel_telegram} label="Telegram" hint={telegramReady ? "Bot ist eingerichtet." : "TELEGRAM_BOT_TOKEN und TELEGRAM_CHAT_ID fehlen noch."} />
          <Toggle name="channel_ntfy" checked={s.channel_ntfy} label="ntfy" hint={ntfyReady ? "Thema ist eingerichtet." : "NTFY_TOPIC fehlt noch."} />
        </fieldset>

        <button className="w-full h-11 rounded-xl bg-felt text-felt-ink font-bold">Einstellungen speichern</button>
      </form>

      <TestNotificationButton />

      <div className="text-center pt-2">
        <LogoutButton />
      </div>
    </main>
  );
}

function Toggle({ name, checked, label, hint }: { name: string; checked: boolean; label: string; hint?: string }) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer">
      <span>
        <span className="font-bold block">{label}</span>
        {hint && <span className="text-sm text-muted block">{hint}</span>}
      </span>
      <span className="relative shrink-0 mt-0.5">
        <input type="checkbox" name={name} defaultChecked={checked} className="peer sr-only" />
        <span className="block w-12 h-7 rounded-full bg-line peer-checked:bg-felt transition-colors" />
        <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
        <span className="absolute inset-0 rounded-full peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-[var(--signal)]" />
      </span>
    </label>
  );
}
