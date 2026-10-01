# Spieltisch Rhein-Main

Eine Web-App fürs Handy, die automatisch neue Brettspiel-Events in Frankfurt und Umgebung findet und dich darüber benachrichtigt.

Einmal am Tag ruft die App alle eingetragenen Quellen ab: Websites von Läden und Spielecafés, Meetup-Kalender und RSS-Feeds. Daraus liest sie die Events aus, kostenlos und ohne KI-Schlüssel. Für neue oder abgesagte Events kannst du dir Nachrichten schicken lassen.

## Was die App kann

- **Übersicht** aller kommenden Events. Das Datum steht auf einem farbigen Plättchen: jede Stadt hat ihre eigene Farbe, wie die Spielfiguren eines Brettspiels.
- **Filter** nach Ort, „Nur neue“ und „Mit Anmeldung“.
- **Detailseite** mit Button „Zur Anmeldung“, Kalender-Export (.ics) und Link zur Originalquelle.
- **Quellen** verwalten: hinzufügen, Adresse ändern, pausieren. Mit Status und Fehlermeldung je Quelle.
- **Benachrichtigungen** per Telegram, ntfy oder Push in der App. Mit Umkreis, Ortsauswahl und stillen Zeiten.
- **Schutz vor Benachrichtigungsflut**:
  - Beim ersten Abruf einer Quelle wird still importiert.
  - Wöchentliche Stammtische melden sich nicht jede Woche neu.
  - Ab vier Events kommt eine Sammelnachricht.
- **Kostenlos**: Die App läuft komplett ohne kostenpflichtige Schlüssel.

## Was du brauchst

**Nichts davon kostet Geld.**

| Dienst | Wofür |
|---|---|
| [GitHub](https://github.com) | Ablage für den Code, damit Vercel ihn findet |
| [Vercel](https://vercel.com) | Hosting, Link zur App und täglicher Abruf |
| [Neon](https://neon.tech) | Datenbank für Events, Quellen und Einstellungen |

Die Tabellen legt die App beim ersten Aufruf selbst an.

**Wie werden Events ohne KI erkannt?**
- **Kalender-Feeds** (z. B. Meetup) werden exakt gelesen.
- **Websites**, die ihre Termine für Google strukturiert einbetten (schema.org), werden ebenfalls exakt gelesen.
- Bei **allen anderen Websites** sucht die App nach Zeilen mit Datum und Spiele-Stichwort, z. B. „Fr, 16.10. 19 Uhr Neuheiten-Abend“. Titel können dabei etwas holprig sein, der Link zur Originalseite ist immer dabei.

Wer später genauere Ergebnisse möchte, kann einen Claude-API-Schlüssel ergänzen (`ANTHROPIC_API_KEY`). Der ist kostenpflichtig und unabhängig von einem Claude-Abo.

## Einrichtung Schritt für Schritt

### 1. Code zu GitHub hochladen

1. Die ZIP-Datei entpacken. Du bekommst einen Ordner `spieltisch`.
2. Auf [github.com](https://github.com) oben rechts auf **+** und dann **New repository** klicken.
3. Name `spieltisch` eingeben, **Private** wählen und **Create repository** klicken.
4. Auf den Link **uploading an existing file** klicken.
5. Den **Inhalt** des Ordners `spieltisch` markieren und ins Browserfenster ziehen. Nicht den Ordner selbst ziehen.
6. Unten **Commit changes** klicken.

**Update einspielen:** Hast du schon ein Repository angelegt und bekommst eine neue Version? Dann im selben Repository oben **Add file → Upload files** wählen und die Schritte 5 und 6 wiederholen. Gleichnamige Dateien werden ersetzt, und Vercel aktualisiert die App danach automatisch.

### 2. Projekt in Vercel anlegen

1. Auf [vercel.com](https://vercel.com) oben rechts **Add New… → Project** wählen.
2. Bei `spieltisch` auf **Import** und dann auf **Deploy** klicken.

Falls das Projekt schon existiert, überspringst du diesen Schritt.

### 3. Neon-Datenbank verbinden

1. Im Vercel-Projekt in der linken Seitenleiste **Storage** öffnen.
2. Deine Neon-Datenbank auswählen und mit dem Projekt verbinden.

**Falls sie dort nicht auftaucht:**
1. In der [Neon-Konsole](https://console.neon.tech) auf **Connect** klicken.
2. Die Adresse kopieren. Sie beginnt mit `postgresql://`.
3. In Schritt 4 zusätzlich einen Eintrag mit dem Namen `DATABASE_URL` anlegen und die Adresse als Wert einfügen.

### 4. Passwort eintragen

1. In der linken Seitenleiste **Environment Variables** öffnen.
2. Bei **Name** (oder **Key**) genau `APP_PASSWORD` eintippen.
3. Bei **Value** dein Wunschpasswort eintippen.
4. Auf **Save** klicken.

Mehr musst du nicht eintragen.

### 5. Neu starten

Links **Deployments** öffnen. Beim obersten Eintrag die drei Punkte anklicken und **Redeploy** wählen.

**Fertig.** Deine Adresse steht auf der Startseite des Projekts unter **Domains**.

Der tägliche Abruf läuft automatisch um 06:00 UTC, das ist 8 Uhr im Sommer und 7 Uhr im Winter.

### 6. App aufs Handy und Quellen prüfen

1. Die App-Adresse auf dem Handy öffnen und mit deinem Passwort anmelden.
2. **iPhone:** In Safari auf **Teilen → Zum Home-Bildschirm** tippen. **Android:** Chrome bietet „App installieren“ an.
3. Unter **Quellen** die gelb markierten Platzhalter ersetzen:
   - **T3 Terminal Entertainment** und **Playce**: die Website heraussuchen, am besten direkt die Seite mit den Terminen. Eintragen, speichern, dann „Aktivieren“.
   - **Meetup-Gruppen**: Die Gruppe auf meetup.com öffnen. Der Teil nach `meetup.com/` in der Adresse ist der Gruppenname. Eintragen als `https://www.meetup.com/GRUPPENNAME/events/ical/`.
4. Auf **Jetzt prüfen** tippen. Der erste Abruf jeder Quelle speichert die Events still. Ab dann meldet die App nur noch Neues.

## Optional: Benachrichtigungen (kostenlos)

Ohne diesen Schritt siehst du neue Events in der App mit „Neu“-Markierung, bekommst aber keine Nachricht.

**Telegram:**
1. In Telegram **@BotFather** öffnen, `/newbot` senden und den Anweisungen folgen. Den Token notieren.
2. Deinem neuen Bot eine Nachricht schreiben, z. B. „Hallo“.
3. Im Browser `https://api.telegram.org/bot<TOKEN>/getUpdates` öffnen. Die Zahl hinter `"chat":{"id":` ist deine Chat-ID.
4. In Vercel unter **Environment Variables** `TELEGRAM_BOT_TOKEN` und `TELEGRAM_CHAT_ID` eintragen und neu starten (Schritt 5).
5. In der App unter **Einstellungen** auf „Testnachricht senden“ tippen.

**Push direkt in der App:** Dafür braucht es zwei Schlüssel aus `npx web-push generate-vapid-keys`, siehe `.env.example`. Auf dem iPhone muss die App außerdem auf dem Home-Bildschirm liegen (ab iOS 16.4).

## Optional: Abruf über GitHub Actions statt Vercel Cron

Dafür gibt es die Datei `.github/workflows/check.yml`. GitHub Actions hat kein knappes Zeitlimit.

1. Im GitHub-Repository unter **Settings → Secrets and variables → Actions** die Werte als Secrets anlegen, die im Workflow aufgelistet sind. Mindestens `DATABASE_URL` ist nötig.
2. In `vercel.json` den `crons`-Eintrag entfernen, damit nicht doppelt geprüft wird.
3. Unter **Actions → Brettspiel-Events prüfen → Run workflow** einmal von Hand testen.

## Optional: Social Media

Instagram und Facebook lassen sich nicht direkt zuverlässig auslesen. Die Plattformen blockieren das aktiv. Die App bietet dafür ein austauschbares Modul an:

- **Apify** (kostenpflichtig, mit Gratiskontingent): `APIFY_TOKEN` setzen und Social-Quellen aktivieren. Automatisches Auslesen kann gegen die Nutzungsbedingungen der Plattformen verstoßen und bricht gelegentlich. Fällt es aus, laufen alle anderen Quellen normal weiter.
- **RSS-Bridge**: Wer eine [RSS-Bridge](https://github.com/RSS-Bridge/rss-bridge) betreibt, legt die Feed-Adresse als Quelle vom Typ „RSS-Feed“ an.

Oft ist es einfacher, die Website oder den Meetup-Kalender eines Ladens als Quelle zu nutzen. Viele Läden posten dort dieselben Termine.

## Lokal ausprobieren

```bash
cp .env.example .env.local   # Werte eintragen
npm install
npm run dev                  # App unter http://localhost:3000
npm run check                # einen Prüflauf im Terminal starten
npm run check -- --force     # auch unveränderte Quellen neu auswerten
npm test                     # Selbsttests der Kernlogik
```

## So funktioniert es

```
Vercel Cron / GitHub Actions / „Jetzt prüfen“
        │
        ▼
  lib/pipeline.ts ── für jede aktive Quelle (3 parallel, Fehler isoliert)
        │   lib/sources/*       → Website (mit robots.txt-Prüfung) · iCal · RSS · Social
        │   unverändert seit letztem Abruf? → überspringen
        │   lib/extract-free.ts → Kalender, schema.org und Datumszeilen (kostenlos)
        │   lib/extract.ts      → optional Claude, wenn ANTHROPIC_API_KEY gesetzt
        │   lib/dedupe.ts       → gleiche Events aus mehreren Quellen zusammenführen
        ▼
  Neon / PostgreSQL (events, sources, settings, push_subscriptions, run_logs)
        │
        ▼
  lib/notify.ts → Telegram · ntfy · Web Push  (Umkreis, Orte, stille Zeiten)
```

**Wann gibt es eine Nachricht?**

- Ein **neues Event** im Umkreis meldet sich, außer:
  - es ist ein regelmäßiger Standardtermin (einstellbar),
  - oder die Quelle wird gerade zum ersten Mal abgerufen.
- **Neuheiten-Abende, Turniere und Sonderevents** melden sich immer, auch wenn sie regelmäßig stattfinden.
- Eine **Absage** oder **Zeitverschiebung** meldet sich, wenn die Quelle, die das Event ursprünglich gemeldet hat, die Änderung zeigt.
- In den **stillen Zeiten** werden Nachrichten zurückgehalten und beim nächsten Lauf gesendet.

**Bekannte Grenze:** Wird ein Event auf einen anderen Tag verschoben, erscheint es als neues Event. Der alte Eintrag bleibt dann bis zu seinem Datum in der Liste stehen.

## Sicherheit

- Die App ist mit einem Passwort geschützt. Das Login-Cookie ist signiert und 180 Tage gültig. Änderst du das Passwort, musst du dich neu anmelden.
- Nur der Server spricht mit der Datenbank. Die Verbindungsadresse gelangt nie in den Browser.
- Alle Datenbankabfragen sind parametrisiert, Eingaben werden nie in SQL-Text eingesetzt.
- `/api/cron` nimmt nur Aufrufe von Vercel an. Mit `CRON_SECRET` wird das zusätzlich über einen Schlüssel geprüft.
- Wird Claude genutzt, werden Inhalte fremder Websites ausdrücklich als Daten übergeben, nicht als Anweisungen.
