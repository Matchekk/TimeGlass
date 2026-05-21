# TimeGlass UI IST-Analyse

Stand: aktuelle Arbeitskopie nach erneuter statischer UI-/UX-/Accessibility-Pruefung.

## 1. Kurzfazit

### Gesamtzustand
TimeGlass wirkt inzwischen wie eine ernsthafte kleine Desktop-App: dunkle Glass-/Apple-Anmutung, klare Hauptnavigation, starke Primaeraktion und ein kompakteres Dashboard fuer kleinere Fenster. Seit der letzten Analyse sind erkennbare Accessibility- und Politur-Fixes eingeflossen: sichtbare `:focus-visible`-Styles, CSS-Tokens, groessere Target Sizes, explizite Button-Types, Nav-ARIA, einige `aria-label`s, dekorative Icons mit `aria-hidden`, Tagesart-Labels in der Heute-Ansicht und robustere Import-Fehlermeldungen.

Der aktuelle Zustand ist damit deutlich besser als die alte Analyse beschrieben hat. Die groessten Restrisiken liegen nicht mehr bei komplett fehlender Tastaturorientierung, sondern bei unvollstaendiger ARIA-Abdeckung fuer Kalender, fehlender Absicherung riskanter Datenaktionen, teils weiterhin farblastiger Statuskommunikation und kognitiv dichter Settings-/Korrektur-UI.

### Groesste Staerken
- Klare Informationsarchitektur: Dashboard, Heute, Woche, Monat, Jahr, Urlaub, Einstellungen.
- Primaere Aktion Ein-/Ausstempeln ist gross, eindeutig und nach Fitts's Law gut erreichbar.
- `main`, `nav`, `section`, `button`, `form`, `label`, `input`, `select` werden weitgehend semantisch passend genutzt.
- `:focus-visible` ist global vorhanden und verbessert Tastaturbedienung erheblich.
- Navigation hat `aria-label`, `aria-current` und explizite Button-Labels.
- Inputs und Buttons haben inzwischen Mindesthoehen um 44px; Pointer Targets sind groesstenteils komfortabel.
- Dashboard-Density ist fuer 1000-1200px deutlich besser: 2-Spalten-Cards, flacherer Hero, kompakter "Wann kann ich gehen?"-Bereich.
- Tagesart wird auf Heute als deutscher Nutzerbegriff statt internem Wert angezeigt.
- Importfehler werden abgefangen und als UI-Meldung formuliert.

### Groesste Schwaechen
- Kalender-/Monats-/Wochenbuttons haben noch keine sprechenden `aria-label`s mit Datum, Netto/Soll/Differenz und Abwesenheit.
- Loeschaktionen fuer Sessions und Abwesenheiten sind weiterhin direkt ausloesbar; es fehlt eine Bestaetigung oder Undo-Strategie.
- JSON-Import ist fehlertoleranter, aber weiterhin nicht mit einer klaren Vorab-Warnung/Bestaetigung abgesichert.
- Session-Edit-Inputs im Inline-Edit-Modus haben keine sichtbaren Labels oder `aria-label`s.
- Positive/negative/aktive/Leave-Zustaende sind besser als zuvor, aber Kalender und Monatskarten vermitteln Status noch stark ueber Farbe/Borders.
- Sichtbare Encoding-Fehler in UI-Strings sind nach dem P0/P1-Fix nicht mehr im `src`-Baum auffindbar.
- Settings bleiben sehr lang und haben viele gleich starke Speichern-Buttons.

### Wichtigste Risiken
- Datenverlust durch versehentliches Loeschen oder Importieren.
- Screenreader-Nutzer bekommen in Kalendern und Inline-Edits zu wenig Kontext.
- Nutzer koennen Periodensalden, freie Tage und Abwesenheiten falsch interpretieren, wenn sie nur Farbe/Borders scannen.
- Kleine Fenster sind nutzbar, aber 900x650 bleibt ein Grenzfall mit deutlichem vertikalem Druck.
- Mojibake kann Vertrauen und Professionalitaet massiv schwaechen.

## 2. Bewertungsgrundlagen

Diese Analyse orientiert sich an:

- WCAG 2.2 AA: Kontrast, Fokus, Tastatur, Labels, ARIA-Namen, Target Size, keine abgeschnittenen Inhalte.
- Nielsen 10 Usability Heuristics: Systemstatus, Nutzerkontrolle, Konsistenz, Fehlerpraevention, Wiedererkennen statt Erinnern.
- Fitts's Law: haeufige/kritische Aktionen brauchen grosse und klare Zielflaechen.
- Hick's Law: nicht zu viele gleich wichtige Optionen gleichzeitig anbieten.
- Gestaltprinzipien: Naehe, Aehnlichkeit, gemeinsame Region, Kontinuitaet, visuelle Hierarchie.
- Desktop-App-Konventionen: klare Primary Action, konsistente Button-Zustaende, ruhige Panels, lesbarer Glass-Effekt.

## 3. Seitenanalyse

### Dashboard

#### Beobachtungen
Dashboard besteht aus Hero-Panel, Punch-Button, StatCards, "Wann kann ich gehen?", Datenqualitaets-Hinweisen und Schnellaktionen. Die Seite beantwortet die zentralen Alltagsfragen schnell.

#### Staerken
- Status und Primaeraktion sind sofort sichtbar.
- Punch-Button ist gross, klar beschriftet und semantisch sauber.
- "Wann kann ich gehen?" ist inzwischen kompakter und nicht mehr wie ein zweites grosses Dashboard.
- Quick-Actions-Gruppe hat `aria-label="Schnellaktionen"`.
- Positive/negative Differenzen haben in `DiffValue` ein sprechendes `aria-label` und sichtbares Vorzeichen.

#### Schwaechen
- "Heute als frei markieren" ist eine fachlich riskante Aktion, wirkt aber wie eine normale sekundare Schnellaktion.
- Datenqualitaets-Hinweise navigieren pauschal zu Heute, auch wenn ein anderes Datum betroffen sein kann.
- StatCards bleiben read-only, koennen optisch aber weiterhin wie interaktive Cards wirken.
- "Gewuenschtes Plus" ist verbessert, aber der Eingabestil `0:30` koennte noch expliziter erklaert werden.
- Encoding bleibt ein Release-Check: Umlaute sollten in der installierten App einmal visuell geprüft werden.

#### Risiken
- Falsches Markieren eines Arbeitstags als frei.
- Nutzer uebersehen konkrete Datenqualitaetsursache oder landen auf falschem Tag.
- Qualitaetsverlust durch kaputte Umlaute.

#### Vorschlaege
- P1: "Heute als frei markieren" als riskante Aktion optisch trennen oder bestaetigen.
- P1: Datenqualitaets-Hinweise auf konkreten Tag fuehren.
- P1: Mojibake beheben.
- P2: Format-Hilfe fuer "Gewuenschtes Plus" ergaenzen.

### Heute

#### Beobachtungen
Heute zeigt Tageskennzahlen und `DayDetail` fuer Korrekturen, Overrides und Session-Verwaltung.

#### Staerken
- Tagesart wird inzwischen als Nutzerlabel angezeigt.
- Vollstaendige Tageswerte: erstes/letztes Stempeln, Brutto, Pause, Netto, Soll, Differenz, Tagesart.
- Korrektur ist direkt erreichbar.

#### Schwaechen
- Acht StatCards erzeugen viel visuelle Masse.
- `DayDetail` kombiniert Tagesoverride, Sessionliste, Session-Edit und neue Session in einem Panel.
- Inline-Edit-Felder fuer Session haben keine Labels.
- Loeschen ist weiterhin direkt ausloesbar.

#### Risiken
- Nutzer verlieren in der Korrekturansicht den Fokus.
- Screenreader-/Tastaturnutzer bekommen im Inline-Edit-Modus zu wenig Kontext.
- Datenverlust durch versehentliches Loeschen.

#### Vorschlaege
- P0: Loeschen absichern.
- P1: Session-Edit-Inputs labeln.
- P2: DayDetail optisch in Subsektionen gliedern.

### Woche

#### Beobachtungen
Woche zeigt Summen, Wochenkarten, Tabellenliste und DayDetail fuer den ausgewaehlten Tag.

#### Staerken
- Uebersicht und Detail sind kombiniert.
- Buttons haben inzwischen explizit `type="button"`.
- Aktive Tagesauswahl hat sichtbares Shape-Signal via Border/Inset.

#### Schwaechen
- Kalenderbuttons haben kein `aria-label`.
- Tagesdaten werden doppelt dargestellt: Wochenkarten und Tabellenliste.
- Farbige Differenzwerte bleiben stark visuell/farbgetrieben.

#### Risiken
- Screenreader-Kontext fuer Tagesbuttons ist schwach.
- Doppelte Darstellung erhoeht kognitive Last.

#### Vorschlaege
- P1: `aria-label` fuer Wochenkarten und Day-Line-Buttons mit Datum, Netto, Soll, Differenz, Abwesenheit.
- P2: Bei kleinen Hoehen Kalender oder Tabelle priorisieren.

### Monat

#### Beobachtungen
Monat zeigt Summen, Monatskalender und DayDetail.

#### Staerken
- Kalenderstruktur ist visuell schnell scannbar.
- Abwesenheiten werden in Zellen angezeigt.
- Responsive Basis ist vorhanden.

#### Schwaechen
- Kalenderzellen haben kein sprechendes `aria-label`.
- Abwesenheit, aktive Zelle und positive/negative Differenz werden vor allem ueber Farbe/Borders vermittelt.
- Kleine Zellen koennen Informationen dicht stapeln.

#### Risiken
- Nicht-visuelle Nutzer koennen Monatskontext schlecht erfassen.
- Abwesenheiten oder negative Tage werden uebersehen.

#### Vorschlaege
- P1: Sprechende Labels fuer jeden Kalendertag.
- P1: Zusatzeichen/Badge fuer Abwesenheit und aktive Auswahl.
- P2: Kalenderzellen bei 900-1000px noch staerker verdichten oder Listenalternative anbieten.

### Jahr

#### Beobachtungen
Jahr zeigt Jahreswerte und 12 Monatskarten mit Drilldown.

#### Staerken
- Ruhige, schnelle Jahresuebersicht.
- Monatskarten sind echte Buttons.

#### Schwaechen
- Monatsbuttons haben kein `aria-label`.
- Zukuenftige Monate zeigen `0:00`, was als echte Null missverstanden werden kann.
- Klickbarkeit koennte visuell klarer sein.

#### Risiken
- Falsche Interpretation zukuenftiger Monate.

#### Vorschlaege
- P1: Zukuenftige Monate als "noch nicht gestartet" markieren.
- P1: `aria-label` fuer Monatsbuttons.
- P2: Chevron oder "Monat anzeigen" als Interaktionshinweis.

### Urlaub / Abwesenheit

#### Beobachtungen
Urlaub kombiniert Uebersicht, Formular und Liste.

#### Staerken
- Icon-only Bearbeiten/Loeschen haben inzwischen `aria-label`s und `type="button"`.
- Empty State vorhanden.
- Formular ist labelbasiert.

#### Schwaechen
- Loeschen bleibt direkt ohne Bestaetigung.
- "Frei", "Feiertag", "Sonstiges" bleiben fachlich erklaerungsbeduerftig.
- Disabled-Minutenfeld ist optisch besser, aber fachlicher Kontext fuer Halb-/Ganztag fehlt.

#### Risiken
- Versehentliches Loeschen von Abwesenheiten.
- Falsche Interpretation von "Frei" gegenueber Arbeitsfrei/Freizeitausgleich.

#### Vorschlaege
- P0: Loeschen bestaetigen oder Undo anbieten.
- P1: Abwesenheitsarten kurz erklaeren.
- P2: "Frei" in "Arbeitsfrei" oder "Frei (Soll 0)" praezisieren.

### Einstellungen

#### Beobachtungen
Settings umfassen Arbeitsmodell, Systemintegration, Reminder, Urlaub, Datensicherung, Diagnose.

#### Staerken
- Thematische Gruppierung ist klar.
- Inputs haben Labels.
- Importfehler werden abgefangen und als Meldung ausgegeben.
- Notification-Permission-Hinweis vorhanden.
- Buttons haben inzwischen `type="button"` oder `submit`.

#### Schwaechen
- JSON-Import hat keine Vorab-Bestaetigung/Warnung trotz potenziell grosser Wirkung.
- Viele Speichern-Buttons wirken gleich stark.
- Diagnose ist technisch und visuell gleich wichtig wie echte Einstellungen.
- Begriffe wie "Notifications", `time_entries`, `leave_entries` sind technisch.

#### Risiken
- Nutzer importieren falsche Datei oder verstehen Datenersetzung nicht.
- Nutzer wissen nicht sicher, welche Settings gespeichert sind.

#### Vorschlaege
- P0/P1: JSON-Import mit Bestaetigung und klarer Risikokopie absichern.
- P1: Save-Konzept vereinheitlichen.
- P2: Diagnose einklappbar oder sekundaerer darstellen.

### Tagesdetail / Korrekturansicht

#### Beobachtungen
`DayDetail` ist die zentrale Korrekturansicht fuer Tagesart, Pause, Sollzeit, Notiz, Sessions und neue Sessions.

#### Staerken
- Hauptformular ist sauber labelbasiert.
- Session-Loeschbutton hat inzwischen `aria-label`.
- Sessionzeile ist als Button realisiert und per Tastatur erreichbar.
- Button-Types sind robuster als vorher.

#### Schwaechen
- Session-Loeschen ohne Bestaetigung.
- Inline-Edit-Inputs fuer Start, Ende, Notiz sind nicht gelabelt.
- Bearbeitungsmodus ist nicht klar als Formulargruppe bezeichnet.

#### Risiken
- Datenverlust.
- Screenreader-Kontext im Edit-Modus unzureichend.

#### Vorschlaege
- P0: Loeschbestaetigung.
- P1: Labels/`aria-label`s fuer Inline-Edit.
- P2: Editmodus als kleine Form mit "Abbrechen" und "Speichern" strukturieren.

## 4. Komponentenanalyse

### Buttons

#### Primaerbutton
- Sehr gut sichtbar und gross.
- Echte Button-Semantik, expliziter `type="button"`, dekorative Icons mit `aria-hidden`.
- Hover/Active/Fokus sind definiert.
- Offen: kein Busy-State waehrend DB-Aktion.

#### Sekundaerbuttons
- Gute Mindestgroesse, Hover/Active/Fokus vorhanden.
- Viele Aktionen wirken gleich wichtig.
- Riskante Aktionen nutzen noch keinen Danger-Stil.

#### Iconbuttons
- Mindestgroesse 44px und `aria-label`s fuer Session/Abwesenheit vorhanden.
- Offen: kein Danger-Stil, keine Bestaetigung.

#### Navigation
- `nav aria-label`, `aria-current`, explizite `aria-label`s vorhanden.
- Aktive Seite hat Farbe plus Inset-Shape.
- Im <=950px Sicherheitsmodus werden sichtbare Labels versteckt; zuganglicher Name bleibt aber vorhanden.

### Cards und Panels

- StatCards sind klar gruppiert, responsive und nutzen `clamp()`.
- Positive/negative Karten haben Border-Farbe, aber kein sichtbares Textlabel auf der Card selbst.
- Kalender-/Monatskarten sind klickbar, aber brauchen bessere zugangliche Namen.
- Glass-Effekt ist konsistent; kleine Muted-Texte bleiben kontrastkritisch.
- Panels haben bessere Tokens fuer Radius/Spacing, aber System ist noch nicht vollstaendig tokenisiert.

### Inputs und Toggles

- Hauptformulare haben Labels.
- `input`, `select` haben Mindesthoehe und Fokus.
- Disabled-Zustand ist sichtbar.
- Native Checkboxen sind zugaenglich, aber visuell noch nicht auf Premium-Niveau.
- Inline-Edit-Inputs bleiben Label-Luecke.

### Kalender

- Visuell stark und fuer sehende Nutzer gut scannbar.
- Semantisch schwach: keine `aria-label`s mit kompletter Information, keine Kalender-/Grid-Rollen.
- Status weiter farb-/borderlastig.

### Warnungen und Empty States

- Empty States fuer Abwesenheiten und Sessions vorhanden.
- Fehlertexte sind verstaendlicher geworden, vor allem Import.
- Warnungen koennten noch konkretere Handlungsoptionen enthalten.

## 5. Accessibility-Analyse

| Bereich | Status | Schweregrad | Kommentar |
|---|---|---|---|
| Fokus | Verbessert | Mittel | Globaler `:focus-visible` Ring vorhanden. Visuelle Qualitaet muss in echter App gegen Glass-Hintergrund geprueft werden. |
| Tastatur | Verbessert | Mittel | Echte Buttons/Inputs und Fokus sind vorhanden. Lange Tab-Reihenfolge in Settings/DayDetail bleibt. |
| ARIA Navigation | Gut | Niedrig | `nav`, `aria-current`, `aria-label` vorhanden. |
| ARIA Iconbuttons | Teilweise gut | Mittel | Session/Leave Iconbuttons gelabelt; Kalender/Monat fehlen. |
| Kalenderlabels | Offen | Hoch | Datumsbuttons brauchen vollstaendige Accessible Names. |
| Inline-Edit-Labels | Offen | Hoch | Session-Edit-Felder brauchen Labels oder `aria-label`s. |
| Kontrast | Teilweise offen | Mittel | Haupttexte wirken okay; kleine `rgba`-Muted-Texte und Glass-Borders sollten gemessen werden. |
| Target Size | Gut | Niedrig | 44px-Minimum fuer viele Controls vorhanden. |
| Farbe als Information | Teilweise offen | Mittel | Vorzeichen hilft, aber Kalender/aktive/Leave-Zustaende bleiben farblastig. |
| Riskante Aktionen | Offen | Hoch/Kritisch | Loeschen/Import brauchen Bestaetigung oder Undo. |

## 6. Responsive-/Density-Analyse

Statische Breakpoint-Simulation:

| Fenstergroesse | Layout okay? | Horizontale Scrollbar? | Vertikaler Druck | Abgeschnittene Inhalte? | Konkrete Probleme |
|---|---|---:|---:|---:|---|
| 1600x900 | Ja | Nein erwartet | Niedrig | Nein erwartet | Sehr komfortabel, 3 Spalten, viel Luft. |
| 1366x768 | Ja | Nein erwartet | Niedrig bis mittel | Nein erwartet | 3 Spalten mit ca. 355px Cards, noch gut. |
| 1280x720 | Ja | Nein erwartet | Mittel | Nein erwartet | 2 Spalten, Cardbreite ca. 510px, mehr vertikale Hoehe. |
| 1200x800 | Ja | Nein erwartet | Mittel | Nein erwartet | Gute Desktop-Dichte, Sidebar links sinnvoll. |
| 1100x700 | Ja | Nein erwartet | Mittel | Nein erwartet | Kompakt, Settings/DayDetail scrollen spuerbar. |
| 1000x650 | Grenzfall, nutzbar | Nein erwartet | Mittel bis hoch | Nein erwartet | 2-Spalten-Dashboard gut, Kalender/Settings dicht. |
| 900x650 | Sicherheitsmodus | Nein erwartet | Hoch | Nein erwartet | Sidebar klappt oben/kompakt, sichtbarer Main ca. 436px; Scroll bleibt notwendig. |

Simulationsergebnisse:
- 1600x900: content 1314px, 3 Spalten, Card ca. 428px.
- 1366x768: content 1093px, 3 Spalten, Card ca. 355px.
- 1280x720: content 1034px, 2 Spalten, Card ca. 510px.
- 1200x800: content 954px, 2 Spalten, Card ca. 470px.
- 1100x700: content 880px, 2 Spalten, Card ca. 433px.
- 1000x650: content 780px, 2 Spalten, Card ca. 383px.
- 900x650: content 876px, 2 Spalten, Card ca. 431px, kollabierte Sidebar.

## 7. Visual-Design-Konsistenz

### Spacing
Jetzt gibt es erste Tokens (`--space-panel`, Radius-/Surface-/Focus-Tokens). Trotzdem existieren noch viele Einzelwerte. Gut genug fuer v0.2.x, aber Design-System ist noch nicht komplett.

### Typografie
`clamp()` fuer Hero, Cards und Kalenderwerte ist sinnvoll. Kleine Labels (`eyebrow`, muted, calendar small) bleiben potentiell kontrastkritisch.

### Farben
Palette ist stimmig. Positive/negative/warn/error sind konsistent, aber semantische CSS-Tokens fuer Statusfarben fehlen noch.

### Buttons
Buttons sind konsistenter: Hover, Active, Focus, Disabled, Mindestgroesse. Danger-Variante fehlt.

### Cards
Cards wirken hochwertig. Interaktive Cards sollten mit Chevron/Label klarer von read-only Cards getrennt werden.

### Glass-Effekt
Optisch hochwertig, aber kleine Texte auf transluzenten Flaechen sollten mit echtem Kontrasttest gemessen werden.

## 8. Microcopy

### Verbessert
- Tagesart wird auf Heute als "Arbeitstag", "Frei", "Krank", "Urlaub", "Sonstiges" gezeigt.
- "Gewuenschtes Plus" hat mit "Zielpuffer" mehr Kontext.
- Importfehler sind handlungsnaeher.

### Weiter problematisch
- "Frei" bleibt uneindeutig: arbeitsfrei, Freizeitausgleich oder Sollzeit 0?
- "Heute fehlt" besser: "Heute noch offen".
- "Woche" in Sidebar besser: "Wochenbilanz".
- "Datenqualitaet" besser sichtbar als "Bitte pruefen", technischer Begriff sekundar.
- "Notifications" besser "Benachrichtigungen".
- `time_entries`/`leave_entries` nur fuer Diagnose okay, nicht fuer normale Nutzer.
- Sichtbare Umlaute sollten in der installierten App geprüft werden.

## 9. Priorisierte Fix-Liste

| Prioritaet | Problem | Datei(en) | Aufwand | Nutzen | Umsetzungsidee | Risiko, falls nicht behoben |
|---|---|---|---|---|---|---|
| P0 | Loeschen ohne Bestaetigung/Undo | `src/components/DayDetail.tsx`, `src/pages/LeavePage.tsx`, `src/styles/global.css` | M | Verhindert Datenverlust | Confirm-Dialog oder zweistufiges Loeschen; Danger-Stil | Versehentlich geloeschte Sessions/Abwesenheiten |
| P0 | Encoding-Regressionen in sichtbaren UI-Texten vermeiden | mehrere `src/**/*.tsx`, ggf. Markdown | S | Professionalitaet und Verstaendlichkeit | Vor Release nach kaputten Umlauten suchen und App visuell prüfen | UI wirkt defekt/unserioes |
| P1 | Kalender-/Monatsbuttons ohne sprechende Accessible Names | `WeekPage.tsx`, `MonthPage.tsx`, `YearPage.tsx` | M | Screenreader-Kontext | `aria-label` mit Datum, Netto, Soll, Differenz, Abwesenheit | Kalender bleibt visuell-only |
| P1 | Inline-Edit-Inputs ohne Labels | `DayDetail.tsx` | S | Bessere Screenreader-/Tastaturnutzung | Sichtbare kompakte Labels oder `aria-label`s fuer Start, Ende, Notiz | Unklarer Edit-Kontext |
| P1 | JSON-Import ohne Vorab-Warnung | `SettingsPage.tsx` | M | Weniger Datenverlust | Confirm vor Import mit Dateiname und Hinweis auf Datenersetzung | Falscher Import |
| P1 | Riskante Quick Action "Heute als frei markieren" zu normal | `DashboardPage.tsx`, `global.css` | S-M | Fehlerpraevention | Separater Stil/Confirm, Microcopy "Heute arbeitsfrei (Soll 0)" | Falsche Tageskorrektur |
| P1 | Status in Kalendern zu farblastig | `WeekPage.tsx`, `MonthPage.tsx`, `YearPage.tsx`, CSS | M | Robustere Wahrnehmung | Text-/Badge-Signale fuer aktiv, Abwesenheit, Plus/Minus | Zustaende werden uebersehen |
| P2 | Settings zu viele gleich starke Save-Buttons | `SettingsPage.tsx` | M | Weniger kognitive Last | Einheitlicher Save-Status oder klarere Sektionen | Speichern-Verwirrung |
| P2 | Read-only vs clickable Cards unklar | `StatCard.tsx`, Kalender-/Year-Cards, CSS | S | Erwartungsklarheit | Clickable Cards mit Chevron/Action-Hinweis, read-only ohne Interaktionsanmutung | Nutzer klickt ins Leere |
| P2 | Muted-Kontrast nicht gemessen | `global.css` | S | Lesbarkeit | Kontrastmessung, ggf. `--text-muted` heller | Schlechte Lesbarkeit |
| P3 | Vollstaendige Design Tokens fehlen | `global.css` | M | Wartbarkeit | Spacing/Color/Type Tokens erweitern | Stil driftet weiter |
| P3 | Native Checkboxen passen optisch weniger | `SettingsPage.tsx`, CSS | M | Politur | Accessible Switch-Styling | Settings wirken weniger hochwertig |

## 10. Empfohlener naechster Codex-Fix-Prompt

```text
Du bist ein kritischer Senior Frontend-/Accessibility-Entwickler fuer Tauri 2, React, TypeScript und CSS.

Projekt: TimeGlass
Pfad: C:\Stempeluhr

Ziel: Behebe nur die P0/P1-Probleme aus UI_IST_ANALYSE.md. Keine neuen Features, keine DB-Aenderungen, keine Time-Tracking-/Reminder-Logik, keine Dependencies.

Aufgaben:
1. Prüfe sichtbare UI-Strings auf Encoding-Regressionen und korrigiere kaputte Umlaute, falls wieder welche auftauchen.
2. Sichere Loeschaktionen fuer Sessions und Abwesenheiten ab:
   - Confirm oder zweistufige Bestaetigung
   - klarer Danger-Stil
   - keine DB-Logik aendern
3. Ergaenze sprechende `aria-label`s fuer Wochen-, Monats- und Jahresbuttons:
   - Datum/Monat
   - Netto/Soll/Differenz
   - Abwesenheit, falls vorhanden
   - aktiver Zustand, falls sinnvoll
4. Ergaenze Labels oder `aria-label`s fuer Inline-Edit-Inputs in `DayDetail`.
5. Sichere JSON-Import in Settings vor dem Import mit klarer Warnung/Bestaetigung ab.
6. Hebe "Heute als frei markieren" als riskante Korrekturaktion ab oder frage eine Bestaetigung ab.
7. Ergaenze bei Kalendern sichtbare nicht-farbige Statushinweise fuer aktiv/Abwesenheit/Plus-Minus, soweit kompakt moeglich.

Nicht tun:
- keine Layout-Neugestaltung
- keine neuen Features
- keine neuen Tabellen
- keine neuen Dependencies
- keine Businesslogik umbauen

Verifikation:
- npm.cmd run build
- npm.cmd test
- npm.cmd run tauri build

Am Ende berichten:
- geaenderte Dateien
- behobene P0/P1-Punkte
- Accessibility-Restrisiken
- Build-/Testergebnis
```

## 11. Gepruefte Dateien und Befehle

### Gepruefte Dateien
- `src/App.tsx`
- `src/pages/DashboardPage.tsx`
- `src/pages/TodayPage.tsx`
- `src/pages/WeekPage.tsx`
- `src/pages/MonthPage.tsx`
- `src/pages/YearPage.tsx`
- `src/pages/LeavePage.tsx`
- `src/pages/SettingsPage.tsx`
- `src/components/DayDetail.tsx`
- `src/components/PrimaryPunchButton.tsx`
- `src/components/StatCard.tsx`
- `src/styles/global.css`
- `src/lib/formatting.ts`
- `src-tauri/tauri.conf.json`
- `UI_AUDIT.md` als Kontext fuer bereits dokumentierte Verbesserungen

### Befehle
- `git status --short`: Arbeitsbaum enthaelt bereits mehrere geaenderte UI-Dateien sowie `UI_AUDIT.md`; diese Analyse aktualisiert nur `UI_IST_ANALYSE.md`.
- `git diff --stat`: UI-/CSS-/Tauri-Konfigurationsaenderungen im Arbeitsbaum vorhanden.
- `npm.cmd run build`: erfolgreich.
- `npm.cmd test`: erfolgreich, 5 Test-Dateien, 26 Tests.
- Responsive-Simulation fuer 1600x900, 1366x768, 1280x720, 1200x800, 1100x700, 1000x650, 900x650: keine rechnerische horizontale Ueberbreite; 900x650 bleibt hoehenkritisch.

In dieser Analyse-Runde wurden keine App-, CSS-, Datenbank- oder Businesslogik-Dateien geaendert. Aktualisiert wurde nur `UI_IST_ANALYSE.md`.
