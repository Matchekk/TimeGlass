# TimeGlass

TimeGlass ist eine kleine lokale Windows-Desktop-App zur privaten Arbeitszeit- und Gleitzeitübersicht. Sie ersetzt nicht das offizielle Zeiterfassungssystem und dient nur der persönlichen Orientierung.

## Installation

Voraussetzungen:

- Node.js
- Rust/Cargo
- Windows WebView2 Runtime

```powershell
npm.cmd install
```

## Entwicklung Starten

```powershell
npm.cmd run tauri dev
```

Falls nur die Berechnungslogik oder das Web-UI geprüft werden soll:

```powershell
npm.cmd run dev
npm.cmd test
```

## Build Für Windows

```powershell
npm.cmd run tauri build
```

## Datenbank-Speicherort

Die App nutzt SQLite über das Tauri-SQL-Plugin. Die Datenbank wird als `timeglass.db` im App-Datenbereich der Tauri-Anwendung abgelegt, typischerweise unter:

```text
%APPDATA%\de.local.timeglass\timeglass.db
```

## Funktionen

- Einstempeln und Ausstempeln mit genau einer aktiven Session
- Tages-, Wochen-, Monats- und Jahresübersicht
- Gleitzeitkonto ab Startsaldo
- Manuelle Korrektur von Sessions
- Tagesarten wie Arbeitstag, frei, krank, Urlaub und sonstiges
- Manuelle Pause, Sollzeit-Override und Tagesnotiz
- CSV-Export, JSON-Export und JSON-Import
- Arbeitsmodelle für Vollzeit, Teilzeit und reine Ist-Zeit (siehe unten)

## Arbeitsmodelle

TimeGlass kennt fünf Arbeitsmodelle. Die Auswahl bestimmt, wie Sollzeit, Tagesdifferenz und Gleitzeitkonto angezeigt werden. Das Modell wird in den Einstellungen unter „Arbeitsmodell" gewählt.

- **Vollzeit / feste Sollzeit** (`fixed_daily`): Klassische Vollzeit mit fester Tages-Sollzeit pro Arbeitstag. Standardverhalten.
- **Teilzeit mit festen Tagen** (`fixed_weekly_distributed`): Feste Wochenstunden, gleichmäßig auf gewählte Arbeitstage verteilt. Tages-Soll ergibt sich aus Wochenstunden ÷ Anzahl Arbeitstage. Freie Tage haben Soll 0.
- **Teilzeit mit individuellen Tageszielen** (`custom_weekday_targets`): Pro Wochentag eigene Sollzeit. Tage mit Sollzeit 0 zählen automatisch als arbeitsfrei.
- **Flexible Wochenstunden** (`variable_weekly_target`): Festes Wochenziel, freie Tagesverteilung. Es wird **keine Tagesdifferenz** berechnet, einzelne Tage ohne Arbeit erzeugen **keine Unterstunden**. Wochen-, Monats- und Jahresanzeigen rechnen mit Wochenziel-Logik.
- **Nur Ist-Zeit** (`no_target_tracking`): Reine Erfassung gearbeiteter Zeit. **Keine** Sollzeit, **keine** Überstunden, **keine** Unterstunden, **kein** Gleitzeitkonto. Geeignet für Aushilfen, Nebenjobs oder projektbasierte Arbeit.

Wichtig: Wenn kein Sollwert hinterlegt ist, berechnet TimeGlass keine Über- oder Unterstunden. Es entstehen also keine erfundenen Soll-/Differenz-Werte an nicht-gearbeiteten Tagen.

## Gleitzeit-Rest verstehen

TimeGlass unterscheidet bewusst zwischen zwei verschiedenen „Rest"-Werten, damit ein positives Gleitzeitkonto nicht versteckt bleibt:

- **Rest bis Tages-Soll**: Wie viel noch zu arbeiten ist, damit die heutige Sollzeit erreicht ist. Reine Tagesbetrachtung.
- **Rest bis Konto 0**: Wie viel noch zu arbeiten ist, damit das Gleitzeitkonto inklusive heute mindestens 0 bleibt. Nutzt vorhandene Pluszeit aus dem Konto.
- **Gewünschtes Konto-Plus**: Wie viel noch zu arbeiten ist, um einen frei gewählten Konto-Saldo zu erreichen (z. B. +0:30).

Beispiel: Bei +2:00 Gleitzeit, 8:00 Tages-Soll und bereits 5:00 gearbeitet zeigt TimeGlass `Rest bis Tages-Soll 3:00` und `Rest bis Konto 0 1:00` — die fehlenden 2:00 sind durch das Gleitzeitkonto abgedeckt.

In den Modi `no_target_tracking` und `variable_weekly_target` ist die Konto-Logik deaktiviert, und es wird keine Feierabendzeit aus einem Tages-Soll berechnet.

## Hinweis

TimeGlass ist offline, lokal und ohne Telemetrie gebaut. Die App ist keine rechtsverbindliche Zeiterfassung, ersetzt kein offizielles System des Arbeitgebers und ist auch keine HR- oder Lohnabrechnung. Die Arbeitsmodelle dienen ausschließlich der persönlichen Übersicht.
