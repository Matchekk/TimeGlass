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
    CREATE INDEX IF NOT EXISTS idx_time_entries_start_time
    ON time_entries(start_time)
  `);
}
