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

## Hinweis

TimeGlass ist offline, lokal und ohne Telemetrie gebaut. Die App ist keine rechtsverbindliche Zeiterfassung und ersetzt kein offizielles System des Arbeitgebers.
