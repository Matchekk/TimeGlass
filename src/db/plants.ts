import type { Plant, PlantGlassSettings } from "../types";
import { defaultPlantGlassSettings } from "../lib/plantGlass";
import { getDb } from "./schema";
import { getRawSettings, setSetting } from "./settings";

const plantSettingKeys = {
	defaultCheckIntervalDays: "plantglass_default_check_interval_days",
	defaultReminderTime: "plantglass_default_reminder_time",
	reminderEnabled: "plantglass_reminder_enabled",
	showInactivePlants: "plantglass_show_inactive_plants",
} as const;

function boolValue(value: string | undefined, fallback: boolean): boolean {
	return value == null ? fallback : value === "true";
}

function numberValue(value: string | undefined, fallback: number): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function rowToPlant(row: {
	id: string;
	name: string;
	species: string | null;
	location: string;
	check_interval_days: number;
	near_heater: number;
	heater_sensitive: number;
	light_note: string | null;
	last_checked_at: string | null;
	last_watered_at: string | null;
	snoozed_until: string | null;
	notes: string;
	active: number;
	created_at: string;
	updated_at: string;
}): Plant {
	return {
		id: row.id,
		name: row.name,
		species: row.species,
		location: row.location,
		checkIntervalDays: row.check_interval_days,
		nearHeater: Boolean(row.near_heater),
		heaterSensitive: Boolean(row.heater_sensitive),
		lightNote: row.light_note,
		lastCheckedAt: row.last_checked_at,
		lastWateredAt: row.last_watered_at,
		snoozedUntil: row.snoozed_until,
		notes: row.notes,
		active: Boolean(row.active),
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

export async function getPlantGlassSettings(): Promise<PlantGlassSettings> {
	const raw = await getRawSettings();
	return {
		defaultCheckIntervalDays: Math.max(
			1,
			Math.round(
				numberValue(
					raw[plantSettingKeys.defaultCheckIntervalDays],
					defaultPlantGlassSettings.defaultCheckIntervalDays,
				),
			),
		),
		defaultReminderTime:
			raw[plantSettingKeys.defaultReminderTime] ||
			defaultPlantGlassSettings.defaultReminderTime,
		reminderEnabled: boolValue(
			raw[plantSettingKeys.reminderEnabled],
			defaultPlantGlassSettings.reminderEnabled,
		),
		showInactivePlants: boolValue(
			raw[plantSettingKeys.showInactivePlants],
			defaultPlantGlassSettings.showInactivePlants,
		),
	};
}

export async function savePlantGlassSettings(
	settings: PlantGlassSettings,
): Promise<void> {
	await setSetting(
		plantSettingKeys.defaultCheckIntervalDays,
		String(Math.max(1, Math.round(settings.defaultCheckIntervalDays))),
	);
	await setSetting(
		plantSettingKeys.defaultReminderTime,
		settings.defaultReminderTime || "08:30",
	);
	await setSetting(
		plantSettingKeys.reminderEnabled,
		String(settings.reminderEnabled),
	);
	await setSetting(
		plantSettingKeys.showInactivePlants,
		String(settings.showInactivePlants),
	);
}

export async function getPlants(includeInactive = true): Promise<Plant[]> {
	const db = await getDb();
	const rows = await db.select<Parameters<typeof rowToPlant>[0][]>(
		includeInactive
			? "SELECT * FROM plants ORDER BY active DESC, name COLLATE NOCASE"
			: "SELECT * FROM plants WHERE active = 1 ORDER BY name COLLATE NOCASE",
	);
	return rows.map(rowToPlant);
}

export async function savePlant(
	input: Omit<Plant, "id" | "createdAt" | "updatedAt"> & { id?: string },
): Promise<Plant> {
	const db = await getDb();
	const now = new Date().toISOString();
	const plant: Plant = {
		...input,
		id: input.id ?? crypto.randomUUID(),
		species: input.species || null,
		lightNote: input.lightNote || null,
		lastCheckedAt: input.lastCheckedAt ?? null,
		lastWateredAt: input.lastWateredAt ?? null,
		snoozedUntil: input.snoozedUntil ?? null,
		checkIntervalDays: Math.max(1, Math.round(input.checkIntervalDays || 14)),
		createdAt: now,
		updatedAt: now,
	};
	await db.execute(
		`INSERT INTO plants (
			id, name, species, location, check_interval_days, near_heater,
			heater_sensitive, light_note, last_checked_at, last_watered_at,
			snoozed_until, notes, active, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)
		ON CONFLICT(id) DO UPDATE SET
			name = excluded.name,
			species = excluded.species,
			location = excluded.location,
			check_interval_days = excluded.check_interval_days,
			near_heater = excluded.near_heater,
			heater_sensitive = excluded.heater_sensitive,
			light_note = excluded.light_note,
			last_checked_at = excluded.last_checked_at,
			last_watered_at = excluded.last_watered_at,
			snoozed_until = excluded.snoozed_until,
			notes = excluded.notes,
			active = excluded.active,
			updated_at = excluded.updated_at`,
		[
			plant.id,
			plant.name,
			plant.species,
			plant.location,
			plant.checkIntervalDays,
			plant.nearHeater ? 1 : 0,
			plant.heaterSensitive ? 1 : 0,
			plant.lightNote,
			plant.lastCheckedAt,
			plant.lastWateredAt,
			plant.snoozedUntil,
			plant.notes,
			plant.active ? 1 : 0,
			now,
		],
	);
	return plant;
}

export async function updatePlantState(plant: Plant): Promise<void> {
	const db = await getDb();
	await db.execute(
		`UPDATE plants SET
			last_checked_at = $1,
			last_watered_at = $2,
			snoozed_until = $3,
			active = $4,
			updated_at = $5
		WHERE id = $6`,
		[
			plant.lastCheckedAt,
			plant.lastWateredAt,
			plant.snoozedUntil,
			plant.active ? 1 : 0,
			plant.updatedAt,
			plant.id,
		],
	);
}
