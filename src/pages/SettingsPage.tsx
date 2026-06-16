import { CalendarCheck, Download, FileJson, FolderOpen, HardDriveDownload, Save, Upload } from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { saveSettings } from "../db/settings";
import { databaseDisplayPath } from "../db/schema";
import { countTimeEntries, exportData, importData } from "../db/timeEntries";
import { countLeaveEntries, importPublicHolidays } from "../db/leaveEntries";
import { formatMinutes, parseDurationToMinutes } from "../lib/formatting";
import { germanHolidays, REGION_LABELS } from "../lib/holidays";
import { getTargetMinutesForDate, shouldShowDailyDelta, shouldShowOvertimeBalance, todayKey } from "../lib/timeCalculations";
import type { AppData } from "../App";
import type { GermanRegion, ImportExportPayload, Settings, TrayLeftClickAction, WorkModelMode } from "../types";

const weekdays = [
  { value: 1, label: "Mo" },
  { value: 2, label: "Di" },
  { value: 3, label: "Mi" },
  { value: 4, label: "Do" },
  { value: 5, label: "Fr" },
  { value: 6, label: "Sa" },
  { value: 0, label: "So" },
];

const workModelOptions: Array<{ value: WorkModelMode; label: string; helper: string }> = [
  { value: "fixed_daily", label: "Vollzeit / feste Sollzeit", helper: "Feste Sollzeit pro Arbeitstag, z. B. Mo–Fr je 8 Stunden." },
  { value: "fixed_weekly_distributed", label: "Teilzeit mit festen Tagen", helper: "Feste Wochenstunden, verteilt auf gewählte Arbeitstage." },
  { value: "custom_weekday_targets", label: "Teilzeit mit individuellen Tageszielen", helper: "Pro Wochentag eigene Sollzeit, freie Tage sind 0:00." },
  { value: "variable_weekly_target", label: "Flexible Wochenstunden", helper: "Feste Wochenstunden, Tagesverteilung ist frei. Keine Tagesdifferenz." },
  { value: "no_target_tracking", label: "Nur Ist-Zeit", helper: "Reine Erfassung gearbeiteter Zeit. Keine Über- oder Unterstundenberechnung." },
];

const weekdayOrder: Array<{ index: number; label: string }> = [
  { index: 1, label: "Montag" },
  { index: 2, label: "Dienstag" },
  { index: 3, label: "Mittwoch" },
  { index: 4, label: "Donnerstag" },
  { index: 5, label: "Freitag" },
  { index: 6, label: "Samstag" },
  { index: 0, label: "Sonntag" },
];

export function SettingsPage({ data, refresh }: { data: AppData; refresh: () => Promise<void> }) {
  const [settings, setSettings] = useState<Settings>(data.settings);
  const [message, setMessage] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState({
    appVersion: "0.1.0",
    timeEntryCount: 0,
    leaveEntryCount: 0,
    autostartActive: false,
    notificationPermission: "unbekannt",
  });
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void Promise.all([getVersion().catch(() => "0.1.0"), countTimeEntries(), countLeaveEntries(), isEnabled().catch(() => false), isPermissionGranted().catch(() => false)])
      .then(([appVersion, timeEntryCount, leaveEntryCount, autostartActive, notificationsGranted]) =>
        setDiagnostics({
          appVersion,
          timeEntryCount,
          leaveEntryCount,
          autostartActive,
          notificationPermission: notificationsGranted ? "ja" : "nein",
        }),
      );
  }, [data]);

  function patch(next: Partial<Settings>) {
    setSettings((current) => ({ ...current, ...next }));
  }

  const remindersEnabled =
    settings.reminderLongSessionEnabled ||
    settings.reminderClockOutEnabled ||
    settings.reminderNoTimeTodayEnabled ||
    settings.reminderTargetReachedEnabled ||
    settings.notifyUnusualSession;

  async function persistSettings(successMessage = "Einstellungen gespeichert.") {
    if (
      settings.reminderLongSessionEnabled ||
      settings.reminderClockOutEnabled ||
      settings.reminderNoTimeTodayEnabled ||
      settings.reminderTargetReachedEnabled ||
      settings.notifyUnusualSession
    ) {
      const granted = await isPermissionGranted();
      if (!granted) {
        const permission = await requestPermission();
        if (permission !== "granted") {
          setMessage("Einstellungen gespeichert. Benachrichtigungen sind nicht erlaubt, Reminder bleiben ohne Systemmeldung.");
        }
      }
    }
    try {
      if (settings.autostartEnabled) await enable();
      else await disable();
    } catch {
      setMessage("Einstellungen gespeichert. Autostart konnte nicht geändert werden.");
    }
    await saveSettings(settings);
    setMessage((current) => current && current.includes("Autostart") ? current : successMessage);
    await refresh();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await persistSettings();
  }

  function download(filename: string, content: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function exportJson() {
    const payload = await exportData();
    download(`timeglass-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), "application/json");
    await refresh();
  }

  async function exportCsv() {
    const payload = await exportData();
    const rows = [
      `# TimeGlass CSV Export; rounding=${settings.roundingMode}; raw_times_stored=true`,
      "id,start_time,end_time,note,created_at,updated_at",
      ...payload.time_entries.map((entry) => [entry.id, entry.start_time, entry.end_time ?? "", entry.note ?? "", entry.created_at, entry.updated_at].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")),
    ];
    download(`timeglass-${new Date().toISOString().slice(0, 10)}.csv`, rows.join("\n"), "text/csv;charset=utf-8");
    await refresh();
  }

  async function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const confirmed = window.confirm(
      `JSON-Import starten?\n\nDatei: ${file.name}\n\nImport kann bestehende TimeGlass-Daten verändern. Erstelle vorher ein Backup, wenn du unsicher bist.`,
    );
    if (!confirmed) {
      event.target.value = "";
      return;
    }
    try {
      const payload = JSON.parse(await file.text()) as ImportExportPayload;
      await importData(payload);
      setMessage("Import abgeschlossen. Die importierten Daten sind jetzt sichtbar.");
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? `Import fehlgeschlagen: ${err.message}` : "Import fehlgeschlagen. Bitte eine gültige TimeGlass-JSON-Datei auswählen.");
    } finally {
      event.target.value = "";
    }
  }

  async function runManualBackup() {
    try {
      const label = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
      const path = await invoke<string>("create_db_backup", { retention: settings.autoBackupRetention, label });
      setMessage(`Backup erstellt: ${path}`);
    } catch (err) {
      setMessage(err instanceof Error ? `Backup fehlgeschlagen: ${err.message}` : "Backup fehlgeschlagen.");
    }
  }

  async function openBackupFolder() {
    try {
      await invoke("open_backup_dir");
    } catch (err) {
      setMessage(err instanceof Error ? `Backup-Ordner: ${err.message}` : "Backup-Ordner konnte nicht geöffnet werden.");
    }
  }

  async function importHolidays() {
    if (settings.holidayRegion === "none") {
      setMessage("Bitte zuerst ein Bundesland für die Feiertage auswählen.");
      return;
    }
    const year = settings.vacationYear || new Date().getFullYear();
    try {
      const count = await importPublicHolidays(germanHolidays(year, settings.holidayRegion));
      setMessage(
        count > 0
          ? `${count} Feiertage für ${year} (${REGION_LABELS[settings.holidayRegion]}) importiert.`
          : `Keine neuen Feiertage – ${year} ist bereits vollständig hinterlegt.`,
      );
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? `Feiertags-Import fehlgeschlagen: ${err.message}` : "Feiertags-Import fehlgeschlagen.");
    }
  }

  const previewTodaysTarget = useMemo(
    () => getTargetMinutesForDate(todayKey(), undefined, settings),
    [settings],
  );
  const showDailyDeltaInPreview = shouldShowDailyDelta(settings);
  const showOvertimeBalanceInPreview = shouldShowOvertimeBalance(settings);

  function updateWeekdayTarget(index: number, value: string) {
    const minutes = parseDurationToMinutes(value);
    const next = [...settings.weekdayTargets];
    next[index] = minutes != null && minutes > 0 ? minutes : 0;
    patch({ weekdayTargets: next });
  }

  return (
    <div className="page-stack">
      <div className="section-heading">
        <div>
          <span>Einstellungen</span>
          <h1>Arbeitsmodell & Daten</h1>
        </div>
      </div>
      {message && <div className="success-banner">{message}</div>}

      <section className="glass-panel settings-form">
        <h2 className="wide">Arbeitsmodell</h2>
        <p className="muted wide">Bestimmt, wie TimeGlass Sollzeit, Differenzen und Gleitzeit anzeigt. Persönliche Übersicht, keine offizielle Lohnabrechnung.</p>
        <label className="wide">
          Arbeitsmodell auswählen
          <select
            value={settings.workModelMode}
            onChange={(event) => patch({ workModelMode: event.target.value as WorkModelMode })}
          >
            {workModelOptions.map((option) => (
              <option value={option.value} key={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <p className="muted wide" id="work-model-helper">
          {workModelOptions.find((option) => option.value === settings.workModelMode)?.helper}
        </p>

        {settings.workModelMode === "fixed_daily" && (
          <>
            <div className="wide">
              <span className="field-title">Arbeitstage</span>
              <div className="segmented" role="group" aria-label="Arbeitstage auswählen">
                {weekdays.map((day) => (
                  <button
                    type="button"
                    className={settings.workdays.includes(day.value) ? "active" : ""}
                    key={day.value}
                    aria-pressed={settings.workdays.includes(day.value)}
                    onClick={() => patch({ workdays: settings.workdays.includes(day.value) ? settings.workdays.filter((value) => value !== day.value) : [...settings.workdays, day.value].sort() })}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
            <label>
              Sollzeit pro Arbeitstag
              <input
                value={formatMinutes(settings.standardTargetMinutes)}
                onChange={(event) => patch({ standardTargetMinutes: parseDurationToMinutes(event.target.value) ?? settings.standardTargetMinutes })}
                aria-describedby="fixed-daily-help"
              />
            </label>
            <p className="muted wide" id="fixed-daily-help">Eingabe als HH:MM, z. B. 8:00.</p>
          </>
        )}

        {settings.workModelMode === "fixed_weekly_distributed" && (
          <>
            <label>
              Wochenstunden
              <input
                value={formatMinutes(settings.weeklyTargetMinutes)}
                onChange={(event) => patch({ weeklyTargetMinutes: parseDurationToMinutes(event.target.value) ?? settings.weeklyTargetMinutes })}
                aria-describedby="weekly-help"
              />
            </label>
            <p className="muted wide" id="weekly-help">Eingabe als HH:MM, z. B. 24:00 für 24 Wochenstunden.</p>
            <div className="wide">
              <span className="field-title">Arbeitstage auswählen</span>
              <div className="segmented" role="group" aria-label="Arbeitstage auswählen">
                {weekdays.map((day) => (
                  <button
                    type="button"
                    className={settings.workdays.includes(day.value) ? "active" : ""}
                    key={day.value}
                    aria-pressed={settings.workdays.includes(day.value)}
                    onClick={() => patch({ workdays: settings.workdays.includes(day.value) ? settings.workdays.filter((value) => value !== day.value) : [...settings.workdays, day.value].sort() })}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="wide">
              <span className="field-title">Berechnete Tages-Sollzeit</span>
              <p>
                {settings.workdays.length > 0
                  ? `${formatMinutes(Math.round(settings.weeklyTargetMinutes / settings.workdays.length))} pro Arbeitstag`
                  : "Bitte mindestens einen Arbeitstag auswählen."}
              </p>
            </div>
          </>
        )}

        {settings.workModelMode === "custom_weekday_targets" && (
          <div className="wide">
            <span className="field-title">Sollzeit pro Wochentag (HH:MM)</span>
            <p className="muted">Tage mit Sollzeit größer 0 zählen automatisch als Arbeitstag.</p>
            <div className="weekday-target-grid">
              {weekdayOrder.map((day) => (
                <label key={day.index} className="weekday-target-row">
                  <span>{day.label}</span>
                  <input
                    aria-label={`Sollzeit ${day.label}`}
                    value={formatMinutes(settings.weekdayTargets[day.index] ?? 0)}
                    onChange={(event) => updateWeekdayTarget(day.index, event.target.value)}
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        {settings.workModelMode === "variable_weekly_target" && (
          <>
            <label>
              Wochenstunden
              <input
                value={formatMinutes(settings.weeklyTargetMinutes)}
                onChange={(event) => patch({ weeklyTargetMinutes: parseDurationToMinutes(event.target.value) ?? settings.weeklyTargetMinutes })}
                aria-describedby="variable-help"
              />
            </label>
            <p className="muted wide" id="variable-help">
              In diesem Modus wird keine Tagesdifferenz berechnet. Tage ohne Arbeit erzeugen keine Unterstunden.
            </p>
          </>
        )}

        {settings.workModelMode === "no_target_tracking" && (
          <p className="muted wide">
            In diesem Modus erfasst TimeGlass nur gearbeitete Zeit. Überstunden, Unterstunden, Gleitzeit und Sollzeit werden nicht berechnet.
          </p>
        )}

        <section className="glass-card preview-card wide" aria-label="Vorschau Arbeitsmodell">
          <span className="eyebrow">Vorschau</span>
          <ul className="preview-list">
            <li>
              <span>Tages-Soll heute</span>
              <strong>{previewTodaysTarget == null ? "Kein Tages-Soll" : formatMinutes(previewTodaysTarget)}</strong>
            </li>
            <li>
              <span>Wochen-Soll</span>
              <strong>
                {settings.workModelMode === "no_target_tracking"
                  ? "nicht aktiv"
                  : settings.workModelMode === "variable_weekly_target"
                    ? formatMinutes(settings.weeklyTargetMinutes)
                    : settings.workModelMode === "fixed_weekly_distributed"
                      ? formatMinutes(settings.weeklyTargetMinutes)
                      : settings.workModelMode === "custom_weekday_targets"
                        ? formatMinutes(settings.weekdayTargets.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0))
                        : formatMinutes(settings.workdays.length * settings.standardTargetMinutes)}
              </strong>
            </li>
            <li>
              <span>Tagesdifferenz aktiv</span>
              <strong>{showDailyDeltaInPreview ? "ja" : "nein"}</strong>
            </li>
            <li>
              <span>Gleitzeitkonto aktiv</span>
              <strong>{showOvertimeBalanceInPreview ? "ja" : "nein"}</strong>
            </li>
            <li>
              <span>Freie Tage erzeugen Minusstunden</span>
              <strong>
                {settings.workModelMode === "fixed_daily" || settings.workModelMode === "custom_weekday_targets"
                  ? "nein, an freien Tagen ist Soll 0"
                  : settings.workModelMode === "fixed_weekly_distributed"
                    ? "nein, nur an Arbeitstagen"
                    : "nein"}
              </strong>
            </li>
          </ul>
        </section>

        <button className="secondary-button wide" type="button" onClick={() => void persistSettings("Arbeitsmodell gespeichert.")}><Save size={16} aria-hidden="true" /> Arbeitsmodell speichern</button>
      </section>

      <form className="glass-panel settings-form" onSubmit={(event) => void submit(event)}>
        <h2 className="wide">Tracking-Beginn und Pausen</h2>
        <label>
          Start-Gleitzeitkonto
          <input
            value={formatMinutes(settings.startBalanceMinutes, true)}
            disabled={!showOvertimeBalanceInPreview}
            aria-describedby="start-balance-help"
            onChange={(event) => patch({ startBalanceMinutes: parseDurationToMinutes(event.target.value) ?? settings.startBalanceMinutes })}
          />
        </label>
        <p className="muted wide" id="start-balance-help">
          {showOvertimeBalanceInPreview
            ? "Anfangswert deines Gleitzeitkontos zum ersten Rechentag."
            : "Im aktuellen Arbeitsmodell ist das Gleitzeitkonto nicht aktiv."}
        </p>
        <label>
          Erster Rechentag
          <input type="date" value={settings.trackingStartDate ?? ""} onChange={(event) => patch({ trackingStartDate: event.target.value || null })} />
        </label>
        <label className="switch-row wide">
          <input type="checkbox" checked={settings.autoBreakEnabled} onChange={(event) => patch({ autoBreakEnabled: event.target.checked })} />
          Automatische Pause aktivieren
        </label>
        <label>
          Auto-Pause ab
          <input value={formatMinutes(settings.autoBreakThresholdMinutes)} onChange={(event) => patch({ autoBreakThresholdMinutes: parseDurationToMinutes(event.target.value) ?? settings.autoBreakThresholdMinutes })} />
        </label>
        <label>
          Auto-Pause Dauer
          <input value={formatMinutes(settings.autoBreakMinutes)} onChange={(event) => patch({ autoBreakMinutes: parseDurationToMinutes(event.target.value) ?? settings.autoBreakMinutes })} />
        </label>
        <button className="secondary-button wide" type="submit"><Save size={16} aria-hidden="true" /> Einstellungen speichern</button>
      </form>

      <section className="glass-panel settings-form">
        <h2 className="wide">Systemintegration</h2>
        <label className="switch-row wide">
          <input type="checkbox" checked={settings.autostartEnabled} onChange={(event) => patch({ autostartEnabled: event.target.checked })} />
          Beim Windows-Start automatisch öffnen
        </label>
        <label className="switch-row wide">
          <input type="checkbox" checked={settings.startMinimized} onChange={(event) => patch({ startMinimized: event.target.checked })} />
          Beim Autostart minimiert starten
        </label>
        <label className="switch-row wide">
          <input type="checkbox" checked={settings.closeToTray} onChange={(event) => patch({ closeToTray: event.target.checked })} />
          Schließen minimiert in den Tray
        </label>
        <label className="switch-row wide">
          <input type="checkbox" checked={settings.lowRamMode} onChange={(event) => patch({ lowRamMode: event.target.checked })} />
          Ressourcenschonender Modus
        </label>
        <label>
          Zeiten runden
          <select value={settings.roundingMode} onChange={(event) => patch({ roundingMode: event.target.value as Settings["roundingMode"] })}>
            <option value="off">Aus</option>
            <option value="5">Auf 5 Minuten</option>
            <option value="10">Auf 10 Minuten</option>
            <option value="15">Auf 15 Minuten</option>
          </select>
        </label>
        <button className="secondary-button wide" type="button" onClick={() => void persistSettings("System gespeichert.")}><Save size={16} aria-hidden="true" /> System speichern</button>
      </section>

      <section className="glass-panel settings-form">
        <h2 className="wide">Stempeln & Tastenkürzel</h2>
        <label className="switch-row wide">
          <input type="checkbox" checked={settings.globalShortcutEnabled} onChange={(event) => patch({ globalShortcutEnabled: event.target.checked })} />
          Globaler Hotkey zum Ein-/Ausstempeln
        </label>
        <label>
          Tastenkürzel
          <input
            value={settings.globalShortcutAccelerator}
            placeholder="CmdOrCtrl+Alt+T"
            aria-describedby="hotkey-help"
            onChange={(event) => patch({ globalShortcutAccelerator: event.target.value })}
          />
        </label>
        <p className="muted wide" id="hotkey-help">Format z. B. „CmdOrCtrl+Alt+T“ oder „Alt+Shift+S“. Wirkt systemweit, auch wenn das Fenster geschlossen ist.</p>
        <label>
          Tray-Linksklick
          <select value={settings.trayLeftClickAction} onChange={(event) => patch({ trayLeftClickAction: event.target.value as TrayLeftClickAction })}>
            <option value="open">Fenster öffnen</option>
            <option value="toggle_punch">Ein-/Ausstempeln</option>
          </select>
        </label>
        <label className="switch-row wide">
          <input type="checkbox" checked={settings.idleDetectionEnabled} onChange={(event) => patch({ idleDetectionEnabled: event.target.checked })} />
          Abwesenheit erkennen während laufender Session
        </label>
        <label>
          Idle-Schwelle
          <input value={formatMinutes(settings.idleThresholdMinutes)} onChange={(event) => patch({ idleThresholdMinutes: parseDurationToMinutes(event.target.value) ?? settings.idleThresholdMinutes })} />
        </label>
        <p className="muted wide">Bei Inaktivität über dieser Dauer schlägt TimeGlass vor, die Abwesenheit von der laufenden Session abzuziehen.</p>
        <button className="secondary-button wide" type="button" onClick={() => void persistSettings("Stempel-Einstellungen gespeichert.")}><Save size={16} aria-hidden="true" /> Stempeln speichern</button>
      </section>

      <section className="glass-panel settings-form">
        <h2 className="wide">Reminder</h2>
        {remindersEnabled && diagnostics.notificationPermission !== "ja" && (
          <div className="inline-warning wide">Benachrichtigungen sind noch nicht erlaubt. TimeGlass fragt erst beim Speichern der Reminder nach.</div>
        )}
        <label className="switch-row wide">
          <input type="checkbox" checked={settings.reminderLongSessionEnabled} onChange={(event) => patch({ reminderLongSessionEnabled: event.target.checked })} />
          Erinnerung, wenn noch eingestempelt nach X Stunden
        </label>
        <label>
          X Stunden
          <input value={formatMinutes(settings.reminderLongSessionMinutes)} onChange={(event) => patch({ reminderLongSessionMinutes: parseDurationToMinutes(event.target.value) ?? settings.reminderLongSessionMinutes })} />
        </label>
        <label className="switch-row wide">
          <input type="checkbox" checked={settings.reminderClockOutEnabled} onChange={(event) => patch({ reminderClockOutEnabled: event.target.checked })} />
          Erinnerung zum Ausstempeln um Uhrzeit
        </label>
        <label>
          Uhrzeit
          <input type="time" value={settings.reminderClockOutTime} onChange={(event) => patch({ reminderClockOutTime: event.target.value })} />
        </label>
        <label className="switch-row wide">
          <input type="checkbox" checked={settings.reminderNoTimeTodayEnabled} onChange={(event) => patch({ reminderNoTimeTodayEnabled: event.target.checked })} />
          Erinnerung, wenn heute noch keine Arbeitszeit erfasst wurde
        </label>
        <label className="switch-row wide">
          <input type="checkbox" checked={settings.reminderTargetReachedEnabled} onChange={(event) => patch({ reminderTargetReachedEnabled: event.target.checked })} />
          Benachrichtigen, wenn heutige Sollzeit erreicht ist
        </label>
        <label>
          Lange Session Hinweis ab
          <input value={formatMinutes(settings.unusualSessionMinutes)} onChange={(event) => patch({ unusualSessionMinutes: parseDurationToMinutes(event.target.value) ?? settings.unusualSessionMinutes })} />
        </label>
        <label className="switch-row wide">
          <input type="checkbox" checked={settings.notifyUnusualSession} onChange={(event) => patch({ notifyUnusualSession: event.target.checked })} />
          Lange Session zusätzlich als Benachrichtigung
        </label>
        <button className="secondary-button wide" type="button" onClick={() => void persistSettings("Reminder gespeichert.")}><Save size={16} aria-hidden="true" /> Reminder speichern</button>
      </section>

      <section className="glass-panel settings-form">
        <h2 className="wide">Urlaub</h2>
        <label>
          Jahresurlaub
          <input type="number" value={settings.annualVacationDays} onChange={(event) => patch({ annualVacationDays: Number(event.target.value) })} />
        </label>
        <label>
          Übertrag
          <input type="number" value={settings.vacationCarryoverDays} onChange={(event) => patch({ vacationCarryoverDays: Number(event.target.value) })} />
        </label>
        <label>
          Urlaubsjahr
          <input type="number" value={settings.vacationYear} onChange={(event) => patch({ vacationYear: Number(event.target.value) })} />
        </label>
        <label>
          Abwesenheitsverhalten
          <select value={settings.defaultPaidAbsenceBehavior} onChange={(event) => patch({ defaultPaidAbsenceBehavior: event.target.value as Settings["defaultPaidAbsenceBehavior"] })}>
            <option value="target_zero">Sollzeit 0 anzeigen</option>
            <option value="counts_as_target">Als Sollzeit erfüllt markieren</option>
          </select>
        </label>
        <label>
          Bundesland (Feiertage)
          <select value={settings.holidayRegion} onChange={(event) => patch({ holidayRegion: event.target.value as GermanRegion })}>
            {Object.entries(REGION_LABELS).map(([code, label]) => (
              <option value={code} key={code}>{label}</option>
            ))}
          </select>
        </label>
        <p className="muted wide">Importiert gesetzliche Feiertage des gewählten Bundeslands für das Urlaubsjahr als ganztägige Feiertags-Einträge (bereits vorhandene werden übersprungen).</p>
        <div className="button-row wide">
          <button className="secondary-button" type="button" disabled={settings.holidayRegion === "none"} onClick={() => void importHolidays()}><CalendarCheck size={16} aria-hidden="true" /> Feiertage {settings.vacationYear || new Date().getFullYear()} importieren</button>
          <button className="secondary-button" type="button" onClick={() => void persistSettings("Urlaubseinstellungen gespeichert.")}><Save size={16} aria-hidden="true" /> Urlaub speichern</button>
        </div>
      </section>

      <section className="glass-panel settings-form">
        <h2 className="wide">Datensicherung</h2>
        <label className="wide">
          Datenbank-Speicherort
          <input readOnly value={databaseDisplayPath} />
        </label>
        <p className="muted wide">Regelmäßige Backups sind empfohlen. Es gibt keine Cloud-Sicherung.</p>
        <label className="switch-row wide">
          <input type="checkbox" checked={settings.autoBackupEnabled} onChange={(event) => patch({ autoBackupEnabled: event.target.checked })} />
          Automatisches DB-Backup beim Start
        </label>
        <label>
          Aufbewahrung (Anzahl)
          <input type="number" min={1} value={settings.autoBackupRetention} onChange={(event) => patch({ autoBackupRetention: Math.max(1, Number(event.target.value) || 1) })} />
        </label>
        <div className="button-row wide">
          <button className="secondary-button" type="button" onClick={() => void persistSettings("Backup-Einstellungen gespeichert.")}><Save size={16} aria-hidden="true" /> Backup-Optionen speichern</button>
          <button className="secondary-button" type="button" onClick={() => void runManualBackup()}><HardDriveDownload size={16} aria-hidden="true" /> DB-Backup jetzt</button>
          <button className="secondary-button" type="button" onClick={() => void openBackupFolder()}><FolderOpen size={16} aria-hidden="true" /> Backup-Ordner öffnen</button>
        </div>
        <div className="button-row wide">
          <button className="secondary-button" type="button" onClick={() => void exportCsv()}><Download size={16} aria-hidden="true" /> CSV exportieren</button>
          <button className="secondary-button" type="button" onClick={() => void exportJson()}><FileJson size={16} aria-hidden="true" /> JSON exportieren</button>
          <button className="secondary-button" type="button" onClick={() => fileInput.current?.click()}><Upload size={16} aria-hidden="true" /> JSON importieren</button>
          <input ref={fileInput} hidden type="file" accept="application/json" onChange={(event) => void importJson(event)} />
        </div>
      </section>

      <section className="glass-panel settings-form">
        <h2 className="wide">Diagnose</h2>
        <DiagnosticsLine label="App-Version" value={diagnostics.appVersion} />
        <DiagnosticsLine label="Tauri" value="2.x" />
        <DiagnosticsLine label="Datenbankpfad" value={databaseDisplayPath} />
        <DiagnosticsLine label="time_entries" value={String(diagnostics.timeEntryCount)} />
        <DiagnosticsLine label="leave_entries" value={String(diagnostics.leaveEntryCount)} />
        <DiagnosticsLine label="Aktive Session" value={data.entries.some((entry) => !entry.end_time) ? "ja" : "nein"} />
        <DiagnosticsLine label="Letzter Export" value={data.settings.lastExportAt || "-"} />
        <DiagnosticsLine label="Autostart aktiv" value={diagnostics.autostartActive ? "ja" : "nein"} />
        <DiagnosticsLine label="Benachrichtigungen erlaubt" value={diagnostics.notificationPermission} />
        <DiagnosticsLine label="Low-RAM-Modus" value={settings.lowRamMode ? "ja" : "nein"} />
      </section>
    </div>
  );
}

function DiagnosticsLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="diagnostics-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
