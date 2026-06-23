import type { Plant, PlantGlassSettings, PlantStatus } from "../types";
import { toDateKey } from "./dateUtils";

export const defaultPlantGlassSettings: PlantGlassSettings = {
	defaultCheckIntervalDays: 14,
	defaultReminderTime: "08:30",
	reminderEnabled: true,
	showInactivePlants: false,
};

export const plantTemplates = [
	{
		name: "Bogenhanf links",
		species: "Bogenhanf / Sansevieria",
		location: "Schreibtisch links / Fensterseite",
		lightNote: "Zwei große Fenster ca. 40 cm entfernt. Heizung aus.",
		checkIntervalDays: 14,
		nearHeater: false,
		notes:
			"Sehr robust. Nur gießen, wenn Erde 3-5 cm tief trocken ist.",
	},
	{
		name: "Bogenhanf rechts",
		species: "Bogenhanf / Sansevieria",
		location: "Schreibtisch rechts / nahe Heizung",
		lightNote: "Fenster ca. 1 m entfernt. Heizung ca. 30 cm entfernt.",
		checkIntervalDays: 14,
		nearHeater: true,
		notes:
			"Wenn Heizung im Winter läuft, wöchentlich prüfen. Trotzdem nur gießen, wenn Erde trocken ist.",
	},
] as const;

export function addDays(date: Date, days: number): Date {
	const next = new Date(date);
	next.setDate(next.getDate() + days);
	return next;
}

export function nextCheckDate(
	plant: Pick<Plant, "lastCheckedAt" | "checkIntervalDays">,
	now = new Date(),
	overrideDays?: number,
): string | null {
	if (!plant.lastCheckedAt) return toDateKey(now);
	const base = new Date(plant.lastCheckedAt);
	const days = Math.max(1, Math.round(overrideDays ?? plant.checkIntervalDays));
	return toDateKey(addDays(base, days));
}

export function isPlantDue(plant: Plant, now = new Date()): boolean {
	if (!plant.active) return false;
	const today = toDateKey(now);
	if (plant.snoozedUntil && plant.snoozedUntil > today) return false;
	if (!plant.lastCheckedAt) return true;
	const dueAt = nextCheckDate(plant, now);
	return dueAt != null && today >= dueAt;
}

export function plantStatus(plant: Plant, now = new Date()): PlantStatus {
	if (!plant.active) return "paused";
	const today = toDateKey(now);
	const tomorrow = toDateKey(addDays(now, 1));
	if (plant.snoozedUntil === tomorrow) return "snoozed_tomorrow";
	if (isPlantDue(plant, now)) return "due_today";
	const dueAt = nextCheckDate(plant, now);
	if (dueAt && dueAt <= toDateKey(addDays(now, 3))) return "due_soon";
	return "ok";
}

export function markStillMoist(plant: Plant, now = new Date()): Plant {
	const iso = now.toISOString();
	return {
		...plant,
		lastCheckedAt: iso,
		snoozedUntil: null,
		updatedAt: iso,
	};
}

export function markWatered(plant: Plant, now = new Date()): Plant {
	const iso = now.toISOString();
	return {
		...plant,
		lastCheckedAt: iso,
		lastWateredAt: iso,
		snoozedUntil: null,
		updatedAt: iso,
	};
}

export function snoozeUntilTomorrow(plant: Plant, now = new Date()): Plant {
	const iso = now.toISOString();
	return {
		...plant,
		snoozedUntil: toDateKey(addDays(now, 1)),
		updatedAt: iso,
	};
}

export function heaterHint(plant: Plant): string | null {
	if (!plant.nearHeater) return null;
	return plant.heaterSensitive
		? "Nahe Heizung: im Winter eher wöchentlich prüfen, aber nur bei trockener Erde gießen."
		: "Nahe Heizung: Hinweis zum Prüfen, keine automatische Gießpflicht.";
}

export function plantReminderBody(dueCount: number): string {
	if (dueCount > 1) {
		return `${dueCount} Pflanzen prüfen: Erde 3-5 cm tief testen. Nur gießen, wenn trocken.`;
	}
	return "Erde 3-5 cm tief prüfen. Nur gießen, wenn trocken. Kein Wasser im Übertopf stehen lassen.";
}

export function shouldSendPlantReminder(
	settings: PlantGlassSettings,
	dueCount: number,
	lastReminderDate: string | undefined,
	now = new Date(),
): boolean {
	if (!settings.reminderEnabled || dueCount === 0) return false;
	const hour = now.getHours();
	if (hour < 6 || hour >= 21) return false;
	const today = toDateKey(now);
	if (lastReminderDate === today) return false;
	const [targetHour, targetMinute] = settings.defaultReminderTime
		.split(":")
		.map(Number);
	const target = new Date(now);
	target.setHours(
		Number.isFinite(targetHour) ? targetHour : 8,
		Number.isFinite(targetMinute) ? targetMinute : 30,
		0,
		0,
	);
	return now >= target;
}
