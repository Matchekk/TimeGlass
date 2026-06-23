import { describe, expect, it } from "vitest";
import type { Plant } from "../types";
import { getPlantReminderDecision } from "./reminders";

function plant(overrides: Partial<Plant> = {}): Plant {
	return {
		id: "plant-1",
		name: "Bogenhanf",
		species: null,
		location: "Büro",
		checkIntervalDays: 14,
		nearHeater: false,
		heaterSensitive: false,
		lightNote: null,
		lastCheckedAt: null,
		lastWateredAt: null,
		snoozedUntil: null,
		notes: "",
		active: true,
		createdAt: "2026-06-01T08:00:00.000Z",
		updatedAt: "2026-06-01T08:00:00.000Z",
		...overrides,
	};
}

describe("PlantGlass reminders", () => {
	it("uses PlantGlass check wording", () => {
		const decision = getPlantReminderDecision(
			{
				defaultCheckIntervalDays: 14,
				defaultReminderTime: "08:30",
				reminderEnabled: true,
				showInactivePlants: false,
			},
			[plant()],
			{},
			new Date("2026-06-23T08:45:00.000Z"),
		);
		expect(decision?.title).toBe("PlantGlass: Pflanzen prüfen");
		expect(decision?.body).toContain("prüfen");
		expect(decision?.body).not.toBe("Pflanzen gießen");
	});
});
