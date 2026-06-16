import type { LeaveEntry } from "../types";
import { eachDateInRange } from "../lib/leaveCalculations";
import type { Holiday } from "../lib/holidays";
import { getDb } from "./schema";

export async function getLeaveEntries(): Promise<LeaveEntry[]> {
  const db = await getDb();
  return db.select<LeaveEntry[]>("SELECT * FROM leave_entries ORDER BY start_date, id");
}

export async function getLeaveEntriesForYear(year: number): Promise<LeaveEntry[]> {
  const db = await getDb();
  return db.select<LeaveEntry[]>(
    "SELECT * FROM leave_entries WHERE start_date <= $1 AND end_date >= $2 ORDER BY start_date, id",
    [`${year}-12-31`, `${year}-01-01`],
  );
}

export async function saveLeaveEntry(input: Omit<LeaveEntry, "id" | "created_at" | "updated_at"> & { id?: number | null }): Promise<void> {
  if (input.end_date < input.start_date) throw new Error("Enddatum darf nicht vor Startdatum liegen.");
  const db = await getDb();
  const now = new Date().toISOString();
  if (input.id) {
    await db.execute(
      `UPDATE leave_entries
       SET type = $1, start_date = $2, end_date = $3, amount = $4, custom_minutes = $5, note = $6, updated_at = $7
       WHERE id = $8`,
      [input.type, input.start_date, input.end_date, input.amount, input.custom_minutes, input.note, now, input.id],
    );
    return;
  }
  await db.execute(
    `INSERT INTO leave_entries (type, start_date, end_date, amount, custom_minutes, note, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
    [input.type, input.start_date, input.end_date, input.amount, input.custom_minutes, input.note, now],
  );
}

export async function deleteLeaveEntry(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM leave_entries WHERE id = $1", [id]);
}

export async function replaceLeaveEntries(entries: LeaveEntry[]): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM leave_entries");
  for (const entry of entries) {
    await db.execute(
      `INSERT INTO leave_entries (id, type, start_date, end_date, amount, custom_minutes, note, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        entry.id,
        entry.type,
        entry.start_date,
        entry.end_date,
        entry.amount,
        entry.custom_minutes,
        entry.note,
        entry.created_at,
        entry.updated_at,
      ],
    );
  }
}

/** Legt Feiertage als ganztägige public_holiday-Einträge an. Bereits als
 * Feiertag belegte Tage werden übersprungen. Gibt die Anzahl neuer Einträge zurück. */
export async function importPublicHolidays(holidays: Holiday[]): Promise<number> {
  const db = await getDb();
  const existing = await getLeaveEntries();
  const occupied = new Set(
    existing
      .filter((entry) => entry.type === "public_holiday")
      .flatMap((entry) => eachDateInRange(entry.start_date, entry.end_date)),
  );
  const now = new Date().toISOString();
  let inserted = 0;
  for (const holiday of holidays) {
    if (occupied.has(holiday.date)) continue;
    await db.execute(
      `INSERT INTO leave_entries (type, start_date, end_date, amount, custom_minutes, note, created_at, updated_at)
       VALUES ('public_holiday', $1, $1, 'full_day', NULL, $2, $3, $3)`,
      [holiday.date, holiday.name, now],
    );
    occupied.add(holiday.date);
    inserted += 1;
  }
  return inserted;
}

export async function countLeaveEntries(): Promise<number> {
  const db = await getDb();
  const rows = await db.select<Array<{ count: number }>>("SELECT COUNT(*) as count FROM leave_entries");
  return rows[0]?.count ?? 0;
}
