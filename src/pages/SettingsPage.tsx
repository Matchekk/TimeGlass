import { Download, FileJson, Save, Upload } from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { saveSettings } from "../db/settings";
import { databaseDisplayPath } from "../db/schema";
import { countTimeEntries, exportData, importData } from "../db/timeEntries";
import { countLeaveEntries } from "../db/leaveEntries";
import { formatMinutes, parseDurationToMinutes } from "../lib/formatting";
import type { AppData } from "../App";
import type { ImportExportPayload, Settings } from "../types";

const weekdays = [
  { value: 1, label: "Mo" },
  { value: 2, label: "Di" },
  { value: 3, label: "Mi" },
  { value: 4, label: "Do" },
  { value: 5, label: "Fr" },
  { value: 6, label: "Sa" },
  { value: 0, label: "So" },
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
          setMessage("Einstellungen gespeichert. Notifications sind nicht erlaubt, Reminder bleiben ohne Systemmeldung.");
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
    const payload = JSON.parse(await file.text()) as ImportExportPayload;
    await importData(payload);
    setMessage("Import abgeschlossen.");
    await refresh();
    event.target.value = "";
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
      <form className="glass-panel settings-form" onSubmit={(event) => void submit(event)}>
        <label>
          Standard-Sollzeit
          <input value={formatMinutes(settings.standardTargetMinutes)} onChange={(event) => patch({ standardTargetMinutes: parseDurationToMinutes(event.target.value) ?? settings.standardTargetMinutes })} />
        </label>
        <label>
          Start-Gleitzeitkonto
          <input value={formatMinutes(settings.startBalanceMinutes, true)} onChange={(event) => patch({ startBalanceMinutes: parseDurationToMinutes(event.target.value) ?? settings.startBalanceMinutes })} />
        </label>
        <label>
          Erster Rechentag
          <input type="date" value={settings.trackingStartDate ?? ""} onChange={(event) => patch({ trackingStartDate: event.target.value || null })} />
        </label>
        <div className="wide">
          <span className="field-title">Arbeitstage</span>
          <div className="segmented">
            {weekdays.map((day) => (
              <button
                type="button"
                className={settings.workdays.includes(day.value) ? "active" : ""}
                key={day.value}
                onClick={() => patch({ workdays: settings.workdays.includes(day.value) ? settings.workdays.filter((value) => value !== day.value) : [...settings.workdays, day.value] })}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>
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
        <button className="secondary-button wide" type="submit"><Save size={16} /> Einstellungen speichern</button>
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
        <button className="secondary-button wide" type="button" onClick={() => void persistSettings("System gespeichert.")}><Save size={16} /> System speichern</button>
      </section>

      <section className="glass-panel settings-form">
        <h2 className="wide">Reminder</h2>
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
          Lange Session zusätzlich als Notification
        </label>
        <button className="secondary-button wide" type="button" onClick={() => void persistSettings("Reminder gespeichert.")}><Save size={16} /> Reminder speichern</button>
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
        <button className="secondary-button wide" type="button" onClick={() => void persistSettings("Urlaubseinstellungen gespeichert.")}><Save size={16} /> Urlaub speichern</button>
      </section>

      <section className="glass-panel settings-form">
        <h2 className="wide">Datensicherung</h2>
        <label className="wide">
          Datenbank-Speicherort
          <input readOnly value={databaseDisplayPath} />
        </label>
        <p className="muted wide">Regelmäßige JSON-Backups sind empfohlen. Es gibt keine Cloud-Sicherung.</p>
        <div className="button-row wide">
          <button className="secondary-button" onClick={() => void exportCsv()}><Download size={16} /> CSV exportieren</button>
          <button className="secondary-button" onClick={() => void exportJson()}><FileJson size={16} /> JSON exportieren</button>
          <button className="secondary-button" onClick={() => void exportJson()}><FileJson size={16} /> Backup jetzt erstellen</button>
          <button className="secondary-button" onClick={() => fileInput.current?.click()}><Upload size={16} /> JSON importieren</button>
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
        <DiagnosticsLine label="Notifications erlaubt" value={diagnostics.notificationPermission} />
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
