# Spieltisch Rhein-Main

Eine Web-App fürs Handy, die automatisch neue Brettspiel-Events in Frankfurt und Umgebung findet und dich darüber benachrichtigt.

Einmal am Tag ruft die App alle eingetragenen Quellen ab: Websites von Läden und Spielecafés, Meetup-Kalender, RSS-Feeds und optional Instagram/Facebook. Claude liest daraus die Events aus. Für neue oder abgesagte Events bekommst du eine Nachricht mit Titel, Termin, Ort, Kurzüberblick und Anmeldelink.

## Was die App kann

- **Übersicht** aller kommenden Events. Das Datum steht auf einem farbigen Plättchen: jede Stadt hat ihre eigene Farbe, wie die Spielfiguren eines Brettspiels.
- **Filter** nach Ort, „Nur neue“ und „Mit Anmeldung“.
- **Detailseite** mit Button „Zur Anmeldung“, Kalender-Export (.ics) und Link zur Originalquelle.
- **Quellen** verwalten: hinzufügen, URL ändern, pausieren. Mit Status und Fehlermeldung je Quelle.
- **Benachrichtigungen** per Web Push, Telegram oder ntfy. Mit Umkreis, Ortsauswahl und stillen Zeiten.
- **Schutz vor Benachrichtigungsflut**:
  - Beim ersten Abruf einer Quelle wird still importiert.
  - Wöchentliche Stammtische melden sich nicht jede Woche neu.
  - Ab vier Events kommt eine Sammelnachricht.
- **Spart Kosten**: Hat sich eine Seite seit dem letzten Abruf nicht verändert, wird Claude gar nicht erst gefragt.

## Was du brauchst

Alle Dienste haben einen kostenlosen Einstieg. Nur die Claude API kostet ein paar Cent pro Monat.

| Dienst | Wofür | Pflicht? |
|---|---|---|
| [Vercel](https://vercel.com) | Hosting, Link zur App und täglicher Abruf | Ja |
| [Neon](https://neon.tech) | Datenbank: Events, Quellen, Einstellungen | Ja |
| [Anthropic Console](https://console.anthropic.com) | Claude API zum Auslesen der Events | Ja |
| Telegram | Zuverlässige Benachrichtigungen, auch ohne installierte App | Empfohlen |

Die Tabellen legt die App beim ersten Aufruf selbst an. Einen SQL-Editor brauchst du nicht.

## Einrichtung Schritt für Schritt

### 1. Projekt zu Vercel hochladen

Wähle einen der beiden Wege.

**Weg A: mit dem Terminal (ohne GitHub).** Dafür muss [Node.js](https://nodejs.org) installiert sein.

1. Die ZIP-Datei entpacken und im Terminal in den Ordner `spieltisch` wechseln.
2. `npx vercel` eingeben. Beim ersten Mal öffnet sich der Browser zum Anmelden bei Vercel.
3. Die Fragen mit Enter bestätigen. Vercel erkennt Next.js automatisch.

**Weg B: über GitHub.**

1. Den Ordner `spieltisch` als neues Repository zu GitHub hochladen.
2. Bei Vercel **Add New → Project** wählen und das Repository importieren.

Der erste Aufruf der App zeigt danach „Datenbank noch nicht verbunden“. Das ist richtig so, weiter mit Schritt 2.

### 2. Neon-Datenbank verbinden

Die App braucht die Verbindungsadresse deiner Neon-Datenbank als Umgebungsvariable `DATABASE_URL`.

**Über Vercel (am einfachsten):** Im Vercel-Projekt den Reiter **Storage** öffnen, Neon auswählen und die Datenbank mit dem Projekt verbinden. Vercel trägt `DATABASE_URL` dann automatisch ein.

**Von Hand:** Falls deine bestehende Neon-Datenbank dort nicht auftaucht:

1. In der [Neon-Konsole](https://console.neon.tech) dein Projekt öffnen und auf **Connect** klicken.
2. Die Verbindungsadresse mit eingeschaltetem **Connection pooling** kopieren. Sie enthält `-pooler` und beginnt mit `postgresql://`.
3. In Vercel unter **Settings → Environment Variables** als `DATABASE_URL` eintragen.

Die Adresse enthält dein Datenbank-Passwort. Trag sie nur direkt in Vercel ein und gib sie nirgendwo sonst weiter.

### 3. Claude-API-Schlüssel

In der [Anthropic Console](https://console.anthropic.com) unter **API Keys** einen Schlüssel erzeugen. In Vercel als `ANTHROPIC_API_KEY` eintragen.

Voreingestellt ist das günstige Modell Claude Haiku 4.5. Mit `ANTHROPIC_MODEL` kannst du ein anderes wählen.

### 4. Telegram-Bot anlegen (empfohlen)

1. In Telegram **@BotFather** öffnen, `/newbot` senden und den Anweisungen folgen. Den Token notieren, das wird `TELEGRAM_BOT_TOKEN`.
2. Deinem neuen Bot eine beliebige Nachricht schreiben, zum Beispiel „Hallo“.
3. Im Browser `https://api.telegram.org/bot<TOKEN>/getUpdates` öffnen. Dort steht unter `"chat":{"id": …}` deine Chat-ID, das wird `TELEGRAM_CHAT_ID`.

**Alternative ntfy:** Die App [ntfy](https://ntfy.sh) installieren und ein langes, zufälliges Thema abonnieren, zum Beispiel `spieltisch-k8f3m2q9x`. Den Namen als `NTFY_TOPIC` eintragen und in der App den Kanal „ntfy“ einschalten.

### 5. Push-Schlüssel erzeugen (optional)

Nur nötig, wenn Benachrichtigungen auch direkt in der App ankommen sollen, nicht nur über Telegram. Im Projektordner im Terminal:

```bash
npx web-push generate-vapid-keys
```

Den **Public Key** als `NEXT_PUBLIC_VAPID_PUBLIC_KEY` und den **Private Key** als `VAPID_PRIVATE_KEY` eintragen. Für `VAPID_SUBJECT` trägst du `mailto:` plus deine E-Mail-Adresse ein.

### 6. Restliche Umgebungsvariablen und neu bereitstellen

In Vercel unter **Settings → Environment Variables** außerdem eintragen:

| Name | Inhalt |
|---|---|
| `APP_PASSWORD` | Dein Login-Passwort für die App |
| `SESSION_SECRET` | Lange Zufallszeichenkette, z. B. aus `openssl rand -hex 32` oder einem Passwort-Generator |
| `CRON_SECRET` | Eine weitere lange Zufallszeichenkette |
| `APP_URL` | Die Adresse deiner App, z. B. `https://spieltisch.vercel.app` |

Damit die neuen Werte greifen, die App neu bereitstellen: im Reiter **Deployments** beim obersten Eintrag **⋯ → Redeploy** wählen. Oder im Terminal `npx vercel --prod` eingeben.

**Fertig. Deine App ist jetzt unter der Adresse erreichbar, die Vercel anzeigt.**

Der tägliche Abruf ist in `vercel.json` hinterlegt. Er läuft um 06:00 UTC, das ist 8 Uhr im Sommer und 7 Uhr im Winter. Vercel schickt dabei automatisch das `CRON_SECRET` mit.

> **Hinweis zu Limits:** Im kostenlosen Vercel-Plan sind Cron Jobs auf eine geringe Häufigkeit begrenzt, und Funktionen dürfen nur begrenzt lange laufen. Für einen täglichen Abruf reicht das normalerweise. Prüfe die aktuellen Limits in der Vercel-Dokumentation. Läuft der Abruf bei vielen Quellen in ein Zeitlimit, nutze die GitHub-Actions-Variante unten.

### 7. App aufs Handy und Quellen prüfen

1. Die App-Adresse auf dem Handy öffnen und mit deinem Passwort anmelden.
2. **iPhone:** In Safari auf **Teilen → Zum Home-Bildschirm** tippen. Danach die App vom Home-Bildschirm öffnen. Nur so funktionieren Push-Benachrichtigungen, und erst ab iOS 16.4.
   **Android:** Chrome bietet „App installieren“ an.
3. Unter **Einstellungen** auf „Benachrichtigungen einschalten“ tippen. Danach mit „Testnachricht senden“ prüfen, ob alles ankommt.
4. Unter **Quellen** die gelb markierten Platzhalter ersetzen:
   - **T3 Terminal Entertainment** und **Playce**: die Website heraussuchen, am besten direkt die Seite mit den Terminen. Eintragen, speichern, dann „Aktivieren“.
   - **Meetup-Gruppen**: Die Gruppe auf meetup.com öffnen. Der Teil nach `meetup.com/` in der Adresse ist der Gruppenname. Eintragen als `https://www.meetup.com/GRUPPENNAME/events/ical/`.
5. Auf **Jetzt prüfen** tippen. Der erste Abruf jeder Quelle speichert die Events still. Ab dann meldet die App nur noch Neues.

## Optional: Abruf über GitHub Actions statt Vercel Cron

Dafür gibt es die Datei `.github/workflows/check.yml`. GitHub Actions hat kein knappes Zeitlimit.

1. Im GitHub-Repository unter **Settings → Secrets and variables → Actions** dieselben Werte als Secrets anlegen, die im Workflow aufgelistet sind, darunter `DATABASE_URL`.
2. In `vercel.json` den `crons`-Eintrag entfernen, damit nicht doppelt geprüft wird.
3. Unter **Actions → Brettspiel-Events prüfen → Run workflow** einmal von Hand testen.

## Optional: Social Media

Instagram und Facebook lassen sich nicht direkt zuverlässig auslesen. Die Plattformen blockieren das aktiv, und ihre offiziellen Schnittstellen funktionieren nur für eigene Accounts. Die App bietet dafür ein austauschbares Modul an:

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
        │   lib/sources/*  → Website (mit robots.txt-Prüfung) · iCal · RSS · Social
        │   unverändert seit letztem Abruf? → überspringen
        │   lib/extract.ts → Claude liest Events als strukturierte Daten aus
        │   lib/dedupe.ts  → gleiche Events aus mehreren Quellen zusammenführen
        ▼
  Neon / PostgreSQL (events, sources, settings, push_subscriptions, run_logs)
        │
        ▼
  lib/notify.ts → Web Push · Telegram · ntfy  (Umkreis, Orte, stille Zeiten)
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

- Die App ist mit einem Passwort geschützt. Das Login-Cookie ist signiert und 180 Tage gültig.
- Nur der Server spricht mit der Datenbank. Die Verbindungsadresse gelangt nie in den Browser.
- Alle Datenbankabfragen sind parametrisiert, Eingaben werden nie in SQL-Text eingesetzt.
- `/api/cron` ist mit `CRON_SECRET` geschützt.
- Inhalte fremder Websites werden Claude ausdrücklich als Daten übergeben, nicht als Anweisungen.
