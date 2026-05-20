import { Plus, Save, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { addEntry, deleteEntry, saveDayOverride, updateEntry } from "../db/timeEntries";
import { dateTimeLocalValue, localInputToIso, toDateKey } from "../lib/dateUtils";
import { formatClock, minutesToInput, parseDurationToMinutes } from "../lib/formatting";
import type { DayOverride, DaySummary, DayType, TimeEntry } from "../types";

interface Props {
  day: DaySummary;
  entries: TimeEntry[];
  override?: DayOverride;
  onChanged: () => Promise<void>;
}

const dayTypes: Array<{ value: DayType; label: string }> = [
  { value: "work", label: "Arbeitstag" },
  { value: "free", label: "Frei" },
  { value: "sick", label: "Krank" },
  { value: "vacation", label: "Urlaub" },
  { value: "other", label: "Sonstiges" },
];

export function DayDetail({ day, entries, override, onChanged }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [manualBreak, setManualBreak] = useState(minutesToInput(override?.manual_break_minutes));
  const [target, setTarget] = useState(minutesToInput(override?.target_minutes));
  const [dayType, setDayType] = useState<DayType>(override?.day_type ?? "work");
  const [note, setNote] = useState(override?.note ?? "");
  const [newStart, setNewStart] = useState(`${day.date}T09:00`);
  const [newEnd, setNewEnd] = useState(`${day.date}T17:00`);
  const [newNote, setNewNote] = useState("");
  const isFriday = new Date(`${day.date}T00:00:00`).getDay() === 5;

  useEffect(() => {
    setManualBreak(minutesToInput(override?.manual_break_minutes));
    setTarget(minutesToInput(override?.target_minutes));
    setDayType(override?.day_type ?? "work");
    setNote(override?.note ?? "");
    setNewStart(`${day.date}T09:00`);
    setNewEnd(`${day.date}T17:00`);
    setNewNote("");
  }, [day.date, override?.manual_break_minutes, override?.target_minutes, override?.day_type, override?.note]);

  const dayEntries = useMemo(
    () => entries.filter((entry) => toDateKey(new Date(entry.start_time)) === day.date).sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [entries, day.date],
  );

  async function guard(action: () => Promise<void>) {
    try {
      setError(null);
      await action();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Änderung fehlgeschlagen.");
    }
  }

  function saveOverride(event: FormEvent) {
    event.preventDefault();
    void guard(async () => {
      await saveDayOverride({
        date: day.date,
        manual_break_minutes: manualBreak.trim() ? parseDurationToMinutes(manualBreak) : null,
        target_minutes: target.trim() ? parseDurationToMinutes(target) : null,
        day_type: dayType,
        note: note.trim() || null,
      });
    });
  }

  function addSession(event: FormEvent) {
    event.preventDefault();
    void guard(async () => {
      await addEntry(localInputToIso(newStart), newEnd ? localInputToIso(newEnd) : null, newNote.trim() || null);
      setNewNote("");
    });
  }

  function applyFridayPause(minutes: number) {
    const value = minutesToInput(minutes);
    setManualBreak(value);
    void guard(async () => {
      await saveDayOverride({
        date: day.date,
        manual_break_minutes: minutes,
        target_minutes: target.trim() ? parseDurationToMinutes(target) : null,
        day_type: dayType,
        note: note.trim() || null,
      });
    });
  }

  return (
    <section className="glass-panel day-detail">
      <div className="section-heading">
        <div>
          <span>Tagesdetail</span>
          <h2>{day.date}</h2>
        </div>
      </div>
      {error && <div className="inline-error">{error}</div>}
      <form className="form-grid" onSubmit={saveOverride}>
        <label>
          Tagesart
          <select value={dayType} onChange={(event) => setDayType(event.target.value as DayType)}>
            {dayTypes.map((type) => (
              <option value={type.value} key={type.value}>{type.label}</option>
            ))}
          </select>
        </label>
        <label>
          Manuelle Pause
          <input value={manualBreak} onChange={(event) => setManualBreak(event.target.value)} placeholder="0:30" />
        </label>
        <label>
          Sollzeit überschreiben
          <input value={target} onChange={(event) => setTarget(event.target.value)} placeholder="8:00" />
        </label>
        <label className="wide">
          Notiz
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Homeoffice, krank, Arzttermin..." />
        </label>
        {isFriday && (
          <div className="friday-options wide">
            <span className="field-title">Freitag</span>
            <div className="button-row">
              <button className="secondary-button" type="button" onClick={() => applyFridayPause(0)}>Früher Schluss · keine Pause</button>
              <button className="secondary-button" type="button" onClick={() => applyFridayPause(60)}>1 Stunde Pause · länger arbeiten</button>
            </div>
          </div>
        )}
        <button className="secondary-button wide" type="submit"><Save size={16} /> Speichern</button>
      </form>

      <div className="session-list">
        {dayEntries.map((entry) => (
          <SessionRow entry={entry} key={entry.id} onChanged={onChanged} onError={setError} />
        ))}
        {dayEntries.length === 0 && <p className="muted">Noch keine Sessions für diesen Tag.</p>}
      </div>

      <form className="form-grid compact" onSubmit={addSession}>
        <label>
          Kommen
          <input type="datetime-local" value={newStart} onChange={(event) => setNewStart(event.target.value)} />
        </label>
        <label>
          Gehen
          <input type="datetime-local" value={newEnd} onChange={(event) => setNewEnd(event.target.value)} />
        </label>
        <label>
          Notiz
          <input value={newNote} onChange={(event) => setNewNote(event.target.value)} />
        </label>
        <button className="secondary-button" type="submit"><Plus size={16} /> Session hinzufügen</button>
      </form>
    </section>
  );
}

function SessionRow({ entry, onChanged, onError }: { entry: TimeEntry; onChanged: () => Promise<void>; onError: (message: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState(dateTimeLocalValue(entry.start_time));
  const [end, setEnd] = useState(entry.end_time ? dateTimeLocalValue(entry.end_time) : "");
  const [note, setNote] = useState(entry.note ?? "");

  async function persist() {
    try {
      await updateEntry(entry.id, localInputToIso(start), end ? localInputToIso(end) : null, note.trim() || null);
      setEditing(false);
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Session konnte nicht gespeichert werden.");
    }
  }

  async function remove() {
    try {
      await deleteEntry(entry.id);
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Session konnte nicht gelöscht werden.");
    }
  }

  if (!editing) {
    return (
      <div className="session-row">
        <button className="session-main" onClick={() => setEditing(true)}>
          <strong>{formatClock(entry.start_time)} - {formatClock(entry.end_time)}</strong>
          <span>{entry.note || (entry.end_time ? "Abgeschlossen" : "Läuft")}</span>
        </button>
        <button className="icon-button" title="Session löschen" onClick={() => void remove()}><Trash2 size={16} /></button>
      </div>
    );
  }

  return (
    <div className="session-edit">
      <input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} />
      <input type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} />
      <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Notiz" />
      <button className="secondary-button" onClick={() => void persist()}><Save size={16} /> OK</button>
    </div>
  );
}
