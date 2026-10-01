/**
 * Führt einen Prüflauf außerhalb von Vercel aus – z. B. per GitHub Actions
 * (keine Laufzeitbegrenzung) oder lokal zum Testen:  npm run check
 * Optional: npm run check -- --force   (unveränderte Quellen trotzdem auswerten)
 */
import { runCheck } from "../lib/pipeline";
import { closeDb } from "../lib/db";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    /* Datei nicht vorhanden – Umgebungsvariablen kommen dann z. B. aus GitHub Secrets */
  }
}

const trigger = process.env.GITHUB_ACTIONS ? "github" : "manuell";
runCheck(trigger, { force: process.argv.includes("--force") })
  .then((r) => {
    console.log(`\nFertig: ${r.sourcesOk} Quellen ok, ${r.sourcesFailed} fehlgeschlagen, ${r.eventsNew} neue Events, ${r.eventsChanged} geändert, ${r.notificationsSent} Nachrichten.`);
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
