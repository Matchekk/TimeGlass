import { describe, expect, it } from "vitest";
import {
	appModeStorageKey,
	getStoredAppMode,
	saveAppMode,
	toggleAppMode,
} from "./appMode";

function memoryStorage(initial?: string) {
	const data = new Map<string, string>();
	if (initial) data.set(appModeStorageKey, initial);
	return {
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => data.set(key, value),
	};
}

describe("appMode", () => {
	it("defaults to TimeGlass when no mode is stored", () => {
		expect(getStoredAppMode(memoryStorage())).toBe("timeglass");
	});

	it("switches from TimeGlass to PlantGlass and back", () => {
		expect(toggleAppMode("timeglass")).toBe("plantglass");
		expect(toggleAppMode("plantglass")).toBe("timeglass");
	});

	it("persists the selected app mode locally", () => {
		const storage = memoryStorage();
		saveAppMode("plantglass", storage);
		expect(getStoredAppMode(storage)).toBe("plantglass");
		saveAppMode("timeglass", storage);
		expect(getStoredAppMode(storage)).toBe("timeglass");
	});
});
