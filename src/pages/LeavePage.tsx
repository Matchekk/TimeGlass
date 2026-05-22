import { Edit3, Plus, Trash2 } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import type { AppData } from "../App";
import { deleteLeaveEntry, saveLeaveEntry } from "../db/leaveEntries";
import { leaveTypeLabel, vacationOverview } from "../lib/leaveCalculations";
import type { LeaveAmount, LeaveEntry, LeaveType } from "../types";
import { StatCard } from "../components/StatCard";
import { toDateKey } from "../lib/dateUtils";

const leaveTypes: Array<{ value: LeaveType; label: string }> = [
  { value: "vacation", label: "Urlaub" },
  { value: "sick", label: "Krank" },
  { value: "public_holiday", label: "Feiertag" },
  { value: "time_off", label: "Arbeitsfrei" },
  { value: "other", label: "Sonstiges" },
];

function createEmptyForm() {
  const today = toDateKey();
  return {
    id: null as number | null,
    type: "vacation" as LeaveType,
    start_date: today,
    end_date: today,
    amount: "full_day" as LeaveAmount,
    custom_minutes: "",
    note: "",
  };
}

export function LeavePage({ data, refresh }: { data: AppData; refresh: () => Promise<void> }) {
  const [form, setForm] = useState(createEmptyForm);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const overview = useMemo(() => vacationOverview(data.leaveEntries, data.settings), [data.leaveEntries, data.settings]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const customMinutes = Number(form.custom_minutes || 0);
      if (form.amount === "custom" && (!Number.isFinite(customMinutes) || customMinutes <= 0)) {
        throw new Error("Bitte gültige Minuten für benutzerdefinierte Abwesenheit eintragen.");
      }
      await saveLeaveEntry({
        id: form.id,
        type: form.type,
        start_date: form.start_date,
        end_date: form.end_date,
        amount: form.amount,
        custom_minutes: form.amount === "custom" ? customMinutes : null,
        note: form.note.trim() || null,
      });
      setForm(createEmptyForm());
      setError(null);
      setMessage("Abwesenheit gespeichert.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Abwesenheit konnte nicht gespeichert werden.");
      setMessage(null);
    }
  }

  function edit(entry: LeaveEntry) {
    setForm({
      id: entry.id,
      type: entry.type,
      start_date: entry.start_date,
      end_date: entry.end_date,
      amount: entry.amount,
      custom_minutes: entry.custom_minutes == null ? "" : String(entry.custom_minutes),
      note: entry.note ?? "",
    });
  }

  async function remove(id: number) {
    const confirmed = window.confirm("Abwesenheit wirklich löschen?\nDieser Eintrag wird aus der Übersicht entfernt.");
    if (!confirmed) return;
    await deleteLeaveEntry(id);
    setMessage("Abwesenheit gelöscht.");
    await refresh();
  }

  const mode = data.settings.workModelMode;
  const modeHint = mode === "no_target_tracking"
    ? "Im aktuellen Arbeitsmodell wirkt Urlaub nur als Markierung. TimeGlass berechnet keine Sollzeit-Korrektur."
    : mode === "variable_weekly_target"
      ? "Im aktuellen Arbeitsmodell wirkt Urlaub als Markierung. Die Wochenziel-Berechnung wird nicht automatisch reduziert."
      : null;

  return (
    <div className="page-stack">
      <div className="section-heading">
        <div>
          <span>Urlaub & Abwesenheit</span>
          <h1>Lokale Planung</h1>
        </div>
      </div>
      {message && <div className="success-banner">{message}</div>}
      {modeHint && <div className="inline-warning">{modeHint}</div>}
      <div className="card-grid">
        <StatCard label="Jahresurlaub" value={`${overview.annualDays} T`} detail={`+ ${overview.carryoverDays} T Übertrag`} />
        <StatCard label="Genommen" value={`${overview.takenDays.toFixed(1)} T`} />
        <StatCard label="Geplant" value={`${overview.plannedDays.toFixed(1)} T`} />
        <StatCard label="Verbleibend" value={`${overview.remainingDays.toFixed(1)} T`} tone={overview.remainingDays >= 0 ? "positive" : "negative"} />
      </div>

      <form className="glass-panel settings-form" onSubmit={(event) => void submit(event)}>
        {error && <div className="inline-error wide">{error}</div>}
        <label>
          Art
          <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as LeaveType })}>
            {leaveTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
        </label>
        <label>
          Von
          <input type="date" value={form.start_date} onChange={(event) => setForm({ ...form, start_date: event.target.value })} />
        </label>
        <label>
          Bis
          <input type="date" value={form.end_date} onChange={(event) => setForm({ ...form, end_date: event.target.value })} />
        </label>
        <label>
          Umfang
          <select value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value as LeaveAmount })}>
            <option value="full_day">Ganzer Tag</option>
            <option value="half_day">Halber Tag</option>
            <option value="custom">Benutzerdefiniert</option>
          </select>
        </label>
        <label>
          Minuten
          <input value={form.custom_minutes} disabled={form.amount !== "custom"} onChange={(event) => setForm({ ...form, custom_minutes: event.target.value })} />
        </label>
        <label>
          Notiz
          <input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
        </label>
        <button className="secondary-button wide" type="submit"><Plus size={16} aria-hidden="true" /> {form.id ? "Abwesenheit speichern" : "Abwesenheit eintragen"}</button>
      </form>

      <section className="glass-panel table-panel">
        {data.leaveEntries.map((entry) => (
          <div className="leave-line" key={entry.id}>
            <div>
              <strong>{leaveTypeLabel(entry.type)} · {entry.start_date} bis {entry.end_date}</strong>
              <span>{entry.amount === "half_day" ? "Halber Tag" : entry.amount === "custom" ? `${entry.custom_minutes ?? 0} Minuten` : "Ganzer Tag"}{entry.note ? ` · ${entry.note}` : ""}</span>
            </div>
            <button className="icon-button" type="button" title="Bearbeiten" aria-label={`${leaveTypeLabel(entry.type)} bearbeiten`} onClick={() => edit(entry)}><Edit3 size={16} aria-hidden="true" /></button>
            <button className="icon-button danger-button" type="button" title="Löschen" aria-label={`${leaveTypeLabel(entry.type)} löschen`} onClick={() => void remove(entry.id)}><Trash2 size={16} aria-hidden="true" /></button>
          </div>
        ))}
        {data.leaveEntries.length === 0 && <p className="muted">Noch keine Abwesenheiten erfasst.</p>}
      </section>
    </div>
  );
}
