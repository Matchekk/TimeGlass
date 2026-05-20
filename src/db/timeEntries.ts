import type { DayOverride, ImportExportPayload, TimeEntry } from "../types";
import { dateRangeForKeys } from "../lib/dateUtils";
import { isEntryValid } from "../lib/timeCalculations";
import { getDb } from "./schema";
import { getRawSettings, replaceRawSettings, setSetting } from "./settings";
import { getLeaveEntries, replaceLeaveEntries } from "./leaveEntries";

export async function getActiveEntry(): Promise<TimeEntry | null> {
  const db = await getDb();
  const rows = await db.select<TimeEntry[]>("SELECT * FROM time_entries WHERE end_time IS NULL ORDER BY start_time DESC LIMIT 1");
  return rows[0] ?? null;
}

export async function startEntry(note: string | null = null): Promise<void> {
  if (await getActiveEntry()) throw new Error("Es existiert bereits eine aktive Session.");
  const now = new Date().toISOString();
  const db = await getDb();
  await db.execute(
    "INSERT INTO time_entries (start_time, end_time, note, created_at, updated_at) VALUES ($1, NULL, $2, $3, $3)",
    [now, note, now],
  );
}

export async function stopActiveEntry(): Promise<void> {
  const active = await getActiveEntry();
  if (!active) throw new Error("Es gibt keine aktive Session zum Ausstempeln.");
  const now = new Date().toISOString();
  if (!isEntryValid(active.start_time, now)) throw new Error("Die Endzeit darf nicht vor der Startzeit liegen.");
  const db = await getDb();
  await db.execute("UPDATE time_entries SET end_time = $1, updated_at = $1 WHERE id = $2", [now, active.id]);
}

export async function getEntriesForDateKeys(dateKeys: string[]): Promise<TimeEntry[]> {
  if (dateKeys.length === 0) return [];
  const { startIso, endIso } = dateRangeForKeys(dateKeys);
  const db = await getDb();
  return db.select<TimeEntry[]>(
    "SELECT * FROM time_entries WHERE start_time < $1 AND COALESCE(end_time, $2) > $3 ORDER BY start_time",
    [endIso, new Date().toISOString(), startIso],
  );
}

export async function getAllEntries(): Promise<TimeEntry[]> {
  const db = await getDb();
  return db.select<TimeEntry[]>("SELECT * FROM time_entries ORDER BY start_time");
}

export async function countTimeEntries(): Promise<number> {
  const db = await getDb();
  const rows = await db.select<Array<{ count: number }>>("SELECT COUNT(*) as count FROM time_entries");
  return rows[0]?.count ?? 0;
}

export async function addEntry(startIso: string, endIso: string | null, note: string | null): Promise<void> {
  if (!isEntryValid(startIso, endIso)) throw new Error("Ungültige Zeiten: Ende muss nach Start liegen.");
  if (!endIso && (await getActiveEntry())) throw new Error("Es darf nur eine aktive Session geben.");
  const now = new Date().toISOString();
  const db = await getDb();
  await db.execute(
    "INSERT INTO time_entries (start_time, end_time, note, created_at, updated_at) VALUES ($1, $2, $3, $4, $4)",
    [startIso, endIso, note, now],
  );
}

export async function updateEntry(id: number, startIso: string, endIso: string | null, note: string | null): Promise<void> {
  if (!isEntryValid(startIso, endIso)) throw new Error("Ungültige Zeiten: Ende muss nach Start liegen.");
  if (!endIso) {
    const active = await getActiveEntry();
    if (active && active.id !== id) throw new Error("Es darf nur eine aktive Session geben.");
  }
  const now = new Date().toISOString();
  const db = await getDb();
  await db.execute("UPDATE time_entries SET start_time = $1, end_time = $2, note = $3, updated_at = $4 WHERE id = $5", [
    startIso,
    endIso,
    note,
    now,
    id,
  ]);
}

export async function deleteEntry(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM time_entries WHERE id = $1", [id]);
}

export async function getOverrides(dateKeys: string[]): Promise<DayOverride[]> {
  if (dateKeys.length === 0) return [];
  const db = await getDb();
  const placeholders = dateKeys.map((_, index) => `$${index + 1}`).join(", ");
  return db.select<DayOverride[]>(`SELECT * FROM day_overrides WHERE date IN (${placeholders})`, dateKeys);
}

export async function getAllOverrides(): Promise<DayOverride[]> {
  const db = await getDb();
  return db.select<DayOverride[]>("SELECT * FROM day_overrides ORDER BY date");
}

export async function saveDayOverride(input: Omit<DayOverride, "created_at" | "updated_at">): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO day_overrides (date, manual_break_minutes, target_minutes, day_type, note, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $6)
     ON CONFLICT(date) DO UPDATE SET
       manual_break_minutes = excluded.manual_break_minutes,
       target_minutes = excluded.target_minutes,
       day_type = excluded.day_type,
       note = excluded.note,
       updated_at = excluded.updated_at`,
    [input.date, input.manual_break_minutes, input.target_minutes, input.day_type, input.note, now],
  );
}

export async function exportData(): Promise<ImportExportPayload> {
  const exportedAt = new Date().toISOString();
  await setSetting("last_export_at", exportedAt);
  return {
    version: 1,
    exportedAt,
    settings: await getRawSettings(),
    time_entries: await getAllEntries(),
    day_overrides: await getAllOverrides(),
    leave_entries: await getLeaveEntries(),
  };
}

export async function importData(payload: ImportExportPayload): Promise<void> {
  if (payload.version !== 1) throw new Error("Nicht unterstützte Import-Version.");
  const db = await getDb();
  await db.execute("DELETE FROM time_entries");
  await db.execute("DELETE FROM day_overrides");
  await replaceRawSettings(payload.settings ?? {});

  for (const entry of payload.time_entries ?? []) {
    if (!isEntryValid(entry.start_time, entry.end_time)) continue;
    await db.execute(
      "INSERT INTO time_entries (id, start_time, end_time, note, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)",
      [entry.id, entry.start_time, entry.end_time, entry.note, entry.created_at, entry.updated_at],
    );
  }

  for (const override of payload.day_overrides ?? []) {
    await db.execute(
      `INSERT INTO day_overrides (date, manual_break_minutes, target_minutes, day_type, note, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        override.date,
        override.manual_break_minutes,
        override.target_minutes,
        override.day_type,
        override.note,
        override.created_at,
        override.updated_at,
      ],
    );
  }

  await replaceLeaveEntries(payload.leave_entries ?? []);
}
