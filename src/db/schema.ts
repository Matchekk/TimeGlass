import Database from "@tauri-apps/plugin-sql";

let dbPromise: Promise<Database> | null = null;

export const databaseUrl = "sqlite:timeglass.db";
export const databaseDisplayPath = "%APPDATA%\\de.local.timeglass\\timeglass.db";

export async function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load(databaseUrl).then(async (db) => {
      await migrate(db);
      return db;
    });
  }
  return dbPromise;
}

async function migrate(db: Database): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS time_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_time TEXT NOT NULL,
      end_time TEXT,
      note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK (end_time IS NULL OR end_time > start_time)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS day_overrides (
      date TEXT PRIMARY KEY,
      manual_break_minutes INTEGER,
      target_minutes INTEGER,
      note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await db.execute("ALTER TABLE day_overrides ADD COLUMN day_type TEXT").catch(() => undefined);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS leave_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      amount TEXT NOT NULL,
      custom_minutes INTEGER,
      note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK (end_date >= start_date),
      CHECK (amount IN ('full_day', 'half_day', 'custom')),
      CHECK (type IN ('vacation', 'sick', 'public_holiday', 'time_off', 'other'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS plants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      species TEXT,
      location TEXT NOT NULL,
      check_interval_days INTEGER NOT NULL DEFAULT 14,
      near_heater INTEGER NOT NULL DEFAULT 0,
      heater_sensitive INTEGER NOT NULL DEFAULT 0,
      light_note TEXT,
      last_checked_at TEXT,
      last_watered_at TEXT,
      snoozed_until TEXT,
      notes TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_time_entries_start_time
    ON time_entries(start_time)
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_leave_entries_dates
    ON leave_entries(start_date, end_date)
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_plants_active_check
    ON plants(active, last_checked_at, snoozed_until)
  `);
}
