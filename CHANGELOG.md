# Changelog

Alle nennenswerten Änderungen an TimeGlass werden hier dokumentiert.

## 0.3.0

### Neu

- **Arbeitsmodelle**: Fünf Modi für die Sollzeit-Logik
  - `fixed_daily` — klassische Vollzeit, feste Sollzeit pro Arbeitstag (Standard, unverändert zu 0.2.x)
  - `fixed_weekly_distributed` — feste Wochenstunden, gleichmäßig auf gewählte Arbeitstage verteilt
  - `custom_weekday_targets` — pro Wochentag eigene Sollzeit (z. B. Mo 4h, Di 6h)
  - `variable_weekly_target` — flexible Tagesverteilung, festes Wochenziel, keine Tagesdifferenz
  - `no_target_tracking` — reine Ist-Zeit-Erfassung ohne Sollzeit, ohne Gleitzeit, ohne Über-/Unterstunden
- **Gleitzeit-Restlogik klargestellt**: TimeGlass unterscheidet jetzt explizit zwischen
  - **Rest bis Tages-Soll** — wie viel noch zu arbeiten ist, um die heutige Sollzeit zu erreichen
  - **Rest bis Konto 0** — wie viel noch zu arbeiten ist, damit das Gleitzeitkonto nicht ins Minus rutscht
  - **Durch Gleitzeit abgedeckt** — wie viel Pluszeit aus dem Konto den heutigen Soll-Rest puffert
- Neue Berechnungsfunktion `calculateTodayExitOptions` (Konto-bewusst, vollständig testbar)
- Dashboard-Panel „Wann kann ich gehen?" zeigt jetzt:
  - Rest bis Tages-Soll
  - Rest bis Konto 0 (mit Feierabendzeit, wenn eingestempelt)
  - Gewünschtes Konto-Plus mit Feierabendzeit
  - Hinweis, falls Gleitzeit den heutigen Soll-Rest abdeckt
- TodayPage zeigt zusätzliche Karten: Rest bis Tages-Soll, Rest bis Konto 0, Gleitzeit inkl. heute
- Versionsbump auf 0.3.0 für package.json, src-tauri/tauri.conf.json und src-tauri/Cargo.toml

### Geändert

- Sidebar-Label „Heute noch offen" → „Rest bis Tages-Soll" (verhindert die Verwechslung mit Konto-Rest)
- `DaySummary.targetMinutes` und `.differenceMinutes` sind jetzt `number | null`
  - `null` = kein Tages-Soll definiert (z. B. variable_weekly_target oder no_target_tracking)
  - `0` = explizit arbeitsfrei
- `AppData.flexBalanceMinutes` ist `number | null` — `null` wenn Gleitzeitkonto im aktuellen Modell deaktiviert ist
- SettingsPage neu strukturiert: Bereich „Arbeitsmodell" mit Dropdown, bedingten Feldern und Vorschau-Karte
- Dashboard / Today / Week / Month / Year passen Begriffe und Karten an das gewählte Modell an
- Datenqualitätscheck „Arbeitstag ohne Nettozeit" prüft jetzt explizit auf `targetMinutes > 0`

### Hinweise

- TimeGlass berechnet keine Über- oder Unterstunden, wenn kein Sollwert hinterlegt ist. In `no_target_tracking` und `variable_weekly_target` erzeugen nicht gearbeitete Tage keine Tages-Unterstunden.
- Persönliche Übersicht, keine HR-/Lohnabrechnung, keine rechtsverbindliche Zeiterfassung.
- Bestehende Datenbanken funktionieren ohne Migration weiter — fehlende Settings-Keys werden mit den bisherigen Vollzeit-Defaults belegt.

## 0.2.1

- UI-/Accessibility-Fixes (siehe `UI_AUDIT.md`)

## 0.2.0

- QoL-Update: CSV-/JSON-Export, JSON-Import, Reminders, Low-RAM-Modus

## 0.1.0

- Initiale Version: Einstempeln/Ausstempeln, Tages-/Wochen-/Monats-/Jahresübersicht, Gleitzeitkonto, Urlaub
