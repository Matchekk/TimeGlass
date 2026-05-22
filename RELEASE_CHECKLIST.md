# TimeGlass Release-Checkliste

Eine Sammlung manueller Smoke-Tests für jede neue Version. Wenn alle Fälle hier durchlaufen sind ohne unerwartetes Verhalten, ist die App releasefähig.

## v0.3.0 – Arbeitsmodelle und Konto-bewusste Restlogik

Vorbereitung:

1. Installer ausführen: `src-tauri\target\release\bundle\nsis\TimeGlass_0.3.0_x64-setup.exe`
2. App starten
3. Datenbank-Speicherort kennen: `%APPDATA%\de.local.timeglass\timeglass.db`
4. Vor dem Test ein JSON-Backup über „Einstellungen → Datensicherung → JSON exportieren"

In Einstellungen → Arbeitsmodell den jeweiligen Modus auswählen und speichern. Vorschau-Karte zeigt sofort die abgeleiteten Werte.

### A. fixed_daily ohne Konto

- Modus: Vollzeit / feste Sollzeit
- Mo–Fr je 8:00 Soll
- Startsaldo 0:00, heute 5:00 gearbeitet

Erwartung im Dashboard-Panel „Wann kann ich gehen?":

- Rest bis Tages-Soll: 3:00
- Rest bis Konto 0: 3:00
- Gleitzeit deckt ab: 0:00 (keine Hinweis-Zeile)
- Aktuelles Gleitzeitkonto inkl. heute: -3:00

### B. fixed_daily mit positivem Konto

- Modus: Vollzeit / feste Sollzeit
- 8:00 Soll, heute 5:00 gearbeitet
- Startsaldo +2:00

Erwartung:

- Rest bis Tages-Soll: 3:00
- Rest bis Konto 0: 1:00
- Hinweis-Zeile: „Gleitzeit deckt heute bis zu 2:00 ab"
- Aktuelles Gleitzeitkonto inkl. heute: -1:00

### C. fixed_daily mit ausreichendem Konto

- Modus: Vollzeit / feste Sollzeit
- 8:00 Soll, heute 5:00 gearbeitet
- Startsaldo +4:00

Erwartung:

- Rest bis Tages-Soll: 3:00
- Rest bis Konto 0: 0:00
- Karte „Rest bis Konto 0" in positiver Tönung markiert
- Überschrift: „Gleitzeitkonto bleibt mindestens bei 0"
- Hinweis-Zeile: „Gleitzeit deckt heute bis zu 3:00 ab"
- Aktuelles Gleitzeitkonto inkl. heute: +1:00

### D. fixed_weekly_distributed

- Modus: Teilzeit mit festen Tagen
- Wochenstunden 24:00
- Arbeitstage Mo / Mi / Fr

Erwartung:

- Vorschau: berechnete Tages-Sollzeit 8:00
- Mo, Mi, Fr: je 8:00 Soll
- Di, Do, Sa, So: Soll 0:00, keine Tagesdiff, keine Unterstunden auch wenn nicht gearbeitet

### E. custom_weekday_targets

- Modus: Teilzeit mit individuellen Tageszielen
- Mo 4:00, Di 6:00, Mi 0:00, Do 5:00, Fr 0:00, Sa 0:00, So 0:00

Erwartung:

- Tagesziele exakt wie eingegeben
- Mi und Fr werden in Kalendern als „Frei" geführt
- Vorschau: Wochen-Soll = Summe (= 15:00)

### F. variable_weekly_target

- Modus: Flexible Wochenstunden
- Wochenstunden 20:00

Erwartung:

- Heute zeigt „Kein Tages-Soll", Differenz „nicht aktiv"
- Mo 0:00 Arbeit erzeugt keine Tages-Unterstunden
- Wochenpanel zeigt Wochenziel, Bisher diese Woche, Wochenrest
- Dashboard-Panel „Wann kann ich gehen?" mit Tagesfeierabendzeit ist ausgeblendet
- Statt dessen Wochenfortschritts-Karte sichtbar
- 18:00 Wochen-Ist ergibt -2:00 Wochenbilanz
- 22:00 Wochen-Ist ergibt +2:00 Wochenbilanz

### G. no_target_tracking

- Modus: Nur Ist-Zeit

Erwartung:

- Dashboard zeigt Karten „Heute gearbeitet", „Diese Woche gearbeitet", „Dieser Monat gearbeitet", „Dieses Jahr gearbeitet", „Gesamt erfasst"
- Karte „Gleitzeitkonto" zeigt „nicht aktiv"
- Panel „Wann kann ich gehen?" wird komplett ausgeblendet
- Today-Seite: Soll- und Differenz-Karten zeigen „Kein Tages-Soll" und „nicht aktiv"
- Wochen-/Monats-/Jahres-Seiten: Differenz-Karten zeigen „nicht aktiv"
- Dashboard-Schnellaktion „Heute arbeitsfrei setzen" ist ausgeblendet

### H. Urlaub / Abwesenheit

Pro Modus eine Abwesenheit anlegen:

- **fixed_daily**: Urlaub an einem Arbeitstag → Tages-Soll wird 0 (Standard-Verhalten), keine Minusstunde
- **fixed_daily**: Urlaub an einem freien Tag → keine Extrastunden
- **no_target_tracking**: Hinweisbanner sichtbar „nur Markierung", Tageswerte bleiben null
- **variable_weekly_target**: Hinweisbanner sichtbar „Wochenziel wird nicht automatisch reduziert"

### I. UI / Tray / Reminder / Datensicherung

- [ ] Installation per NSIS-Setup ohne Adminrechte
- [ ] Erster App-Start zeigt leeres Dashboard ohne Crash
- [ ] Einstempeln (Primärbutton im Dashboard)
- [ ] Ausstempeln (Primärbutton ändert Beschriftung)
- [ ] Tray-Icon sichtbar, Tray-Menü zeigt aktuelle Session
- [ ] Tray → „Einstempeln" / „Ausstempeln" funktioniert
- [ ] Tray → „Heute öffnen" wechselt zur Today-Seite
- [ ] Einstellungen → Autostart aktivieren, App neu starten → kommt automatisch
- [ ] Einstellungen → Reminder aktivieren → Permission-Prompt erscheint und kann genehmigt werden
- [ ] Schließen-Verhalten: „Schließen minimiert in den Tray" ein/aus
- [ ] JSON-Export erzeugt valide Datei im Download-Bereich
- [ ] CSV-Export erzeugt valide Datei
- [ ] JSON-Import: Auswahl einer fremden Datei → Bestätigungsdialog erscheint → Abbrechen lässt Daten unverändert
- [ ] JSON-Import: Auswahl einer eigenen Backup-Datei → Bestätigen → Daten korrekt wiederhergestellt, einschließlich `desired_balance_minutes`
- [ ] Session löschen: Dialog erscheint, Abbrechen behält Session, Bestätigen entfernt Session
- [ ] Abwesenheit löschen: Dialog erscheint, beides funktioniert
- [ ] „Heute arbeitsfrei setzen" Dialog erscheint, Bestätigen setzt Tages-Soll auf 0
- [ ] „Gewünschtes Konto-Plus" Eingabe überlebt App-Neustart (Wert wird in `settings.desired_balance_minutes` gespeichert)

### Migration und Bestandsdaten

- [ ] Bestehende v0.2.x-Datenbank starten ohne Settings-Migration: alle alten Werte da, neue Settings greifen Defaults
- [ ] Modus-Wechsel via Dropdown speichert sofort und wirkt aufs Dashboard

### Performance / Stabilität

- [ ] Mehrstündige aktive Session läuft ohne Memory-Wachstum (Low-RAM-Modus aktiv)
- [ ] Wechsel zwischen Seiten ist unter 1 s
- [ ] Bei 900×650 keine abgeschnittenen Inhalte, kein horizontales Scrollen

## Vor dem Tag

- [ ] `npm.cmd run build` grün
- [ ] `npm.cmd test` grün (Soll: 60 Tests)
- [ ] `npm.cmd run tauri build` grün
- [ ] CHANGELOG.md hat Eintrag für die neue Version
- [ ] README.md erklärt die neuen Begriffe
- [ ] Versionen in `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` stimmen überein
- [ ] Diese Checkliste manuell durchlaufen
- [ ] Installer-Pfade dokumentiert

## Git-Befehle für Release

```powershell
git tag -a v0.3.0 -m "TimeGlass v0.3.0 — work models and account-aware exit logic"
git push origin v0.3.0
```

GitHub-Release danach mit beiden Installern als Asset:

- `src-tauri\target\release\bundle\nsis\TimeGlass_0.3.0_x64-setup.exe`
- `src-tauri\target\release\bundle\msi\TimeGlass_0.3.0_x64_en-US.msi`
