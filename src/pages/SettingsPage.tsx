import { Download, FileJson, Save, Upload } from "lucide-react";
import { ChangeEvent, FormEvent, useRef, useState } from "react";
import { saveSettings } from "../db/settings";
import { databaseDisplayPath } from "../db/schema";
import { exportData, importData } from "../db/timeEntries";
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
  const fileInput = useRef<HTMLInputElement>(null);

  function patch(next: Partial<Settings>) {
    setSettings((current) => ({ ...current, ...next }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await saveSettings(settings);
    setMessage("Einstellungen gespeichert.");
    await refresh();
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
  }

  async function exportCsv() {
    const payload = await exportData();
    const rows = [
      "id,start_time,end_time,note,created_at,updated_at",
      ...payload.time_entries.map((entry) => [entry.id, entry.start_time, entry.end_time ?? "", entry.note ?? "", entry.created_at, entry.updated_at].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")),
    ];
    download(`timeglass-${new Date().toISOString().slice(0, 10)}.csv`, rows.join("\n"), "text/csv;charset=utf-8");
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
        <label className="wide">
          Datenbank-Speicherort
          <input readOnly value={databaseDisplayPath} />
        </label>
        <div className="button-row wide">
          <button className="secondary-button" onClick={() => void exportCsv()}><Download size={16} /> CSV exportieren</button>
          <button className="secondary-button" onClick={() => void exportJson()}><FileJson size={16} /> JSON exportieren</button>
          <button className="secondary-button" onClick={() => fileInput.current?.click()}><Upload size={16} /> JSON importieren</button>
          <input ref={fileInput} hidden type="file" accept="application/json" onChange={(event) => void importJson(event)} />
        </div>
      </section>
    </div>
  );
}
