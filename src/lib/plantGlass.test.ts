import { describe, expect, it } from "vitest";
import type { Plant } from "../types";
import {
	heaterHint,
	isPlantDue,
	markStillMoist,
	markWatered,
	plantReminderBody,
	shouldSendPlantReminder,
	snoozeUntilTomorrow,
} from "./plantGlass";

const now = new Date("2026-06-23T08:45:00.000Z");

function plant(overrides: Partial<Plant> = {}): Plant {
	return {
		id: "plant-1",
		name: "Bogenhanf",
		species: "Sansevieria",
		location: "Schreibtisch",
		checkIntervalDays: 14,
		nearHeater: false,
		heaterSensitive: false,
		lightNote: null,
		lastCheckedAt: "2026-06-20T08:00:00.000Z",
		lastWateredAt: "2026-06-10T08:00:00.000Z",
		snoozedUntil: null,
		notes: "",
		active: true,
		createdAt: "2026-06-01T08:00:00.000Z",
		updatedAt: "2026-06-01T08:00:00.000Z",
		...overrides,
	};
}

describe("PlantGlass plant due logic", () => {
	it("treats a plant without lastCheckedAt as due", () => {
		expect(isPlantDue(plant({ lastCheckedAt: null }), now)).toBe(true);
	});

	it("treats a plant checked 14 days ago as due", () => {
		expect(
			isPlantDue(plant({ lastCheckedAt: "2026-06-09T08:00:00.000Z" }), now),
		).toBe(true);
	});

	it("does not treat a plant checked 3 days ago as due", () => {
		expect(isPlantDue(plant(), now)).toBe(false);
	});

	it("does not treat inactive plants as due", () => {
		expect(isPlantDue(plant({ active: false, lastCheckedAt: null }), now)).toBe(
			false,
		);
	});

	it("does not treat snoozed plants as due", () => {
		expect(
			isPlantDue(
				plant({ lastCheckedAt: null, snoozedUntil: "2026-06-24" }),
				now,
			),
		).toBe(false);
	});

	it("sets lastCheckedAt but not lastWateredAt when marked still moist", () => {
		const before = plant();
		const after = markStillMoist(before, now);
		expect(after.lastCheckedAt).toBe(now.toISOString());
		expect(after.lastWateredAt).toBe(before.lastWateredAt);
		expect(after.snoozedUntil).toBeNull();
	});

	it("sets lastCheckedAt and lastWateredAt when marked watered", () => {
		const after = markWatered(plant(), now);
		expect(after.lastCheckedAt).toBe(now.toISOString());
		expect(after.lastWateredAt).toBe(now.toISOString());
		expect(after.snoozedUntil).toBeNull();
	});

	it("snoozes until tomorrow", () => {
		expect(snoozeUntilTomorrow(plant(), now).snoozedUntil).toBe("2026-06-24");
	});

	it("uses reminder copy about checking, not a watering command", () => {
		const body = plantReminderBody(2);
		expect(body).toContain("prüfen");
		expect(body).toContain("Nur gießen, wenn trocken");
		expect(body).not.toBe("Pflanzen gießen");
	});

	it("creates a heater hint without automatic watering duty", () => {
		const hint = heaterHint(plant({ nearHeater: true }));
		expect(hint).toContain("Prüfen");
		expect(hint).toContain("keine automatische Gießpflicht");
	});

	it("sends plant reminders after the configured time and not twice per day", () => {
		const settings = {
			defaultCheckIntervalDays: 14,
			defaultReminderTime: "08:30",
			reminderEnabled: true,
			showInactivePlants: false,
		};
		expect(shouldSendPlantReminder(settings, 1, undefined, now)).toBe(true);
		expect(shouldSendPlantReminder(settings, 1, "2026-06-23", now)).toBe(false);
		expect(
			shouldSendPlantReminder(
				settings,
				1,
				undefined,
				new Date("2026-06-23T02:00:00.000Z"),
			),
		).toBe(false);
	});
});
