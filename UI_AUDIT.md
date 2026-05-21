# UI Audit

## Bewertungsgrundlagen

- WCAG 2.2 AA als praktische Basis fuer Kontrast, Fokus, Tastaturbedienung und semantische Bedienbarkeit.
- Nielsen-Heuristiken: klare Systemzustaende, erkennbare Aktionen, Fehlervermeidung und verstaendliche Rueckmeldungen.
- Fitts's Law und Hick's Law: komfortable Zielflaechen, weniger konkurrierende Primaeraktionen, klare Aktionsgruppen.
- Gestaltprinzipien: Naehe, Aehnlichkeit, gemeinsame Region, Kontinuitaet und visuelle Hierarchie.
- Apple-/Material-inspirierte Desktop-Konventionen: eine dominante Primaeraktion, ruhige Panels, konsistente Buttons und lesbarer Glass-Effekt.

## Gefundene Probleme

- Fokuszustaende waren auf dem dunklen/glassy Hintergrund zu schwach oder nur ueber Border-Farbe sichtbar.
- Button-Zustaende waren uneinheitlich: Hover war vorhanden, Active/Disabled und Mindestgroessen waren nicht durchgaengig definiert.
- Icon-only-Aktionen nutzten teilweise nur `title`; das ist als Accessible Name und fuer Tastaturnutzung zu schwach.
- Kompakte Sidebar blendet sichtbare Labels aus; ohne explizite `aria-label`s verlieren Buttons dort ihren Namen.
- Klickbare Kalender-, Wochen-, Monats- und Session-Cards wirkten nicht immer eindeutig interaktiv.
- Dashboard-Cards und grosse Werte konnten bei kleineren Fenstern zu dominant werden oder Umbrueche riskieren.
- Negative/positive Deltas waren stark farbabhaengig; das Vorzeichen ist jetzt sichtbarer und semantisch beschrieben.
- Der Bereich "Wann kann ich gehen?" war zu laut und hatte ein Input-Label, das im kleinen Card-Kontext nicht robust genug war.
- Importfehler konnten als unkontrollierte Exception enden statt als verstaendliche Rueckmeldung.
- Einige Buttons hatten kein explizites `type`, was in Formularnaehe riskant ist.

## Behobene Probleme

- Einheitliche CSS Custom Properties fuer Radien, Panel-Abstaende, Button-Oberflaechen und Fokus-Ring ergaenzt.
- Sichtbaren `:focus-visible`-Ring fuer Buttons, Inputs, Selects und fokussierbare Elemente eingefuehrt.
- Hover-, Active- und Disabled-Zustaende fuer primaere und sekundare Buttons, Icon-Buttons, Navigationspunkte und klickbare Cards verbessert.
- Mindest-Zielflaechen fuer Navigation, Buttons, Inputs, Session-Zeilen und klickbare Listen auf ca. 44 px gebracht.
- Sidebar-Navigation mit `nav aria-label`, `aria-current`, expliziten Button-Labels und dekorativen Icons versehen.
- Icon-only-Buttons fuer Session/Abwesenheit mit `aria-label` und `type="button"` versehen.
- Dashboard-Leave-Calculator kompakter gemacht; "Gewuenschtes Plus" hat ein sichtbares Label und Ergebnis-Hilfe.
- `DiffValue` nutzt sichtbares Vorzeichen und ein sprechendes `aria-label`.
- Tagesart in der Heute-Ansicht wird als Nutzerbegriff statt internem Wert angezeigt.
- Import-Fehler werden abgefangen und als konkrete Meldung formuliert.
- Responsive CSS fuer 1280, 1120, 950 und 620 px verbessert; Main Content scrollt vertikal als Sicherheitsnetz.
- Tauri-Mindestfenster auf 900 x 650 angehoben, passend zur kleinsten Zielgroesse.
- P0/P1-Fix: Session- und Abwesenheits-Loeschen verlangen jetzt eine Bestaetigung und nutzen einen Danger-Stil.
- P0/P1-Fix: JSON-Import verlangt vor dem Import eine Bestaetigung mit Dateiname und Backup-Hinweis.
- P0/P1-Fix: "Heute arbeitsfrei setzen (Soll 0)" ist als riskantere Schnellaktion abgehoben und bestaetigungspflichtig.
- P0/P1-Fix: Wochen-, Monats- und Jahresbuttons haben sprechendere `aria-label`s mit Datum/Zeitraum und Zeitwerten.
- P0/P1-Fix: Inline-Session-Edit-Felder haben `aria-label`s; der Editmodus bietet Speichern und Abbrechen.
- P0/P1-Fix: Kalender-/Periodenansichten zeigen kompakte Text-Badges fuer Ausgewaehlt, Plus/Minus und Abwesenheiten.
- P0/P1-Fix: Microcopy wurde geschaerft: "Heute noch offen", "Wochenbilanz", "Benachrichtigungen", "Arbeitsfrei".

## Offene Punkte

- Kontrast wurde visuell und anhand der Farbwerte plausibilisiert, aber nicht mit einem automatisierten WCAG-Kontrasttool fuer jeden Textzustand gemessen.
- Vollstaendige native Tauri-Screens konnten im Browser nicht simuliert werden, weil die Web-Ansicht ohne Tauri-Runtime Datenaufrufe nicht ausfuehrt.
- Import/Export- und Tray-nahe Aktionen sollten in der installierten App manuell mit echten Dateien und Tray-Menue geprueft werden.
- Formularvalidierung fuer Zeit-/Dauerfelder verhindert ungueltige Werte noch nicht konsequent an jeder Stelle; die Businesslogik wurde bewusst nicht veraendert.
- Keine automatisierten Accessibility-Tests wie axe integriert, da keine neuen Dependencies gewuenscht waren.

## Manuelle Test-Checkliste

- Tastatur: Tab-Reihenfolge von Sidebar ueber Hauptaktion, Cards/Listen, Formulare und Zurueck; Enter und Space auf allen Buttons testen.
- Fokus: sichtbarer Ring auf Navigation, Einstempeln/Ausstempeln, Quick Actions, Kalender-Tagen, Session-Zeilen, Inputs und Selects.
- Buttons: Hover, Active und Disabled bei Primaerbutton, Secondary Buttons, Icon Buttons, Segmented Buttons und Checkboxen pruefen.
- Confirm-Flows: Session loeschen, Abwesenheit loeschen, JSON importieren und Heute arbeitsfrei setzen jeweils bestaetigen und abbrechen testen.
- Screenreader/ARIA: Wochen-, Monats- und Jahresbuttons grob mit Accessible Name pruefen.
- Dashboard: Status innerhalb von 1 Sekunde erkennbar, eine klare Primaeraktion, keine abgeschnittenen Werte.
- "Wann kann ich gehen?": aktiver und nicht eingestempelter Zustand, Eingabe `0:30`, `1:00`, ungueltiger Text.
- Tagesdetail: Session bearbeiten, speichern, loeschen, neue Session anlegen, Freitag-Buttons.
- Urlaub: Abwesenheit anlegen, bearbeiten, loeschen, Custom-Minuten disabled/enabled.
- Einstellungen: alle Toggle-Reihen, Speichern pro Bereich, Export, Import mit valider und defekter JSON-Datei.
- Responsive: keine horizontale Scrollbar, Sidebar nutzbar, Hauptinhalt scrollbar, Buttons erreichbar.

## Getestete Groessen / Screenshots

- Automatisch im Browser simuliert: 1600x900, 1366x768, 1280x720, 1200x800, 1100x700, 1000x650, 900x650.
- Ergebnis der Browser-Simulation: keine horizontalen Scrollbars in der Shell, keine offscreen Buttons, keine Buttons unter 40 px.
- Einschraenkung: Im Browser erschien erwartbar ein Tauri-Runtime-Fehler bei Datenaufrufen; native Inhalte sollten in der Tauri-App bei denselben Groessen visuell gesichtet werden.
- Empfohlene Screenshot-Serie: Dashboard, Heute/Tagesdetail, Woche, Monat, Urlaub, Einstellungen jeweils bei 1600x900, 1280x720, 1100x700 und 900x650.
