import type { AppMode } from "../types";

export const appModeStorageKey = "timeglass.appMode";

export function parseAppMode(value: string | null | undefined): AppMode {
	return value === "plantglass" ? "plantglass" : "timeglass";
}

export function getStoredAppMode(storage: Pick<Storage, "getItem">): AppMode {
	return parseAppMode(storage.getItem(appModeStorageKey));
}

export function saveAppMode(
	mode: AppMode,
	storage: Pick<Storage, "setItem">,
): void {
	storage.setItem(appModeStorageKey, mode);
}

export function toggleAppMode(mode: AppMode): AppMode {
	return mode === "timeglass" ? "plantglass" : "timeglass";
}
