import type { GermanRegion } from "../types";
import { addDays, toDateKey } from "./dateUtils";

export interface Holiday {
	date: string;
	name: string;
}

export const REGION_LABELS: Record<GermanRegion, string> = {
	none: "Keine (manuell pflegen)",
	BW: "Baden-Württemberg",
	BY: "Bayern",
	BE: "Berlin",
	BB: "Brandenburg",
	HB: "Bremen",
	HH: "Hamburg",
	HE: "Hessen",
	MV: "Mecklenburg-Vorpommern",
	NI: "Niedersachsen",
	NW: "Nordrhein-Westfalen",
	RP: "Rheinland-Pfalz",
	SL: "Saarland",
	SN: "Sachsen",
	ST: "Sachsen-Anhalt",
	SH: "Schleswig-Holstein",
	TH: "Thüringen",
};

const ALL: GermanRegion[] = [
	"BW",
	"BY",
	"BE",
	"BB",
	"HB",
	"HH",
	"HE",
	"MV",
	"NI",
	"NW",
	"RP",
	"SL",
	"SN",
	"ST",
	"SH",
	"TH",
];

/** Ostersonntag nach dem Algorithmus von Meeus/Jones/Butcher (gregorianisch). */
export function easterSunday(year: number): Date {
	const a = year % 19;
	const b = Math.floor(year / 100);
	const c = year % 100;
	const d = Math.floor(b / 4);
	const e = b % 4;
	const f = Math.floor((b + 8) / 25);
	const g = Math.floor((b - f + 1) / 3);
	const h = (19 * a + b - d - g + 15) % 30;
	const i = Math.floor(c / 4);
	const k = c % 4;
	const l = (32 + 2 * e + 2 * i - h - k) % 7;
	const m = Math.floor((a + 11 * h + 22 * l) / 451);
	const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = März, 4 = April
	const day = ((h + l - 7 * m + 114) % 31) + 1;
	return new Date(year, month - 1, day);
}

/** Buß- und Bettag: der Mittwoch vor dem 23. November. */
function penanceDay(year: number): Date {
	const date = new Date(year, 10, 22);
	while (date.getDay() !== 3) date.setDate(date.getDate() - 1);
	return date;
}

interface HolidayDef {
	name: string;
	date: (year: number, easter: Date) => Date;
	regions: GermanRegion[] | "all";
}

const HOLIDAY_DEFS: HolidayDef[] = [
	{ name: "Neujahr", date: (y) => new Date(y, 0, 1), regions: "all" },
	{
		name: "Heilige Drei Könige",
		date: (y) => new Date(y, 0, 6),
		regions: ["BW", "BY", "ST"],
	},
	{
		name: "Internationaler Frauentag",
		date: (y) => new Date(y, 2, 8),
		regions: ["BE", "MV"],
	},
	{ name: "Karfreitag", date: (_y, e) => addDays(e, -2), regions: "all" },
	{ name: "Ostersonntag", date: (_y, e) => e, regions: ["BB"] },
	{ name: "Ostermontag", date: (_y, e) => addDays(e, 1), regions: "all" },
	{ name: "Tag der Arbeit", date: (y) => new Date(y, 4, 1), regions: "all" },
	{
		name: "Christi Himmelfahrt",
		date: (_y, e) => addDays(e, 39),
		regions: "all",
	},
	{ name: "Pfingstsonntag", date: (_y, e) => addDays(e, 49), regions: ["BB"] },
	{ name: "Pfingstmontag", date: (_y, e) => addDays(e, 50), regions: "all" },
	{
		name: "Fronleichnam",
		date: (_y, e) => addDays(e, 60),
		regions: ["BW", "BY", "HE", "NW", "RP", "SL"],
	},
	{
		name: "Mariä Himmelfahrt",
		date: (y) => new Date(y, 7, 15),
		regions: ["SL"],
	},
	{
		name: "Tag der Deutschen Einheit",
		date: (y) => new Date(y, 9, 3),
		regions: "all",
	},
	{
		name: "Reformationstag",
		date: (y) => new Date(y, 9, 31),
		regions: ["BB", "HB", "HH", "MV", "NI", "SN", "ST", "SH", "TH"],
	},
	{
		name: "Allerheiligen",
		date: (y) => new Date(y, 10, 1),
		regions: ["BW", "BY", "NW", "RP", "SL"],
	},
	{ name: "Buß- und Bettag", date: (y) => penanceDay(y), regions: ["SN"] },
	{ name: "Weltkindertag", date: (y) => new Date(y, 8, 20), regions: ["TH"] },
	{
		name: "1. Weihnachtstag",
		date: (y) => new Date(y, 11, 25),
		regions: "all",
	},
	{
		name: "2. Weihnachtstag",
		date: (y) => new Date(y, 11, 26),
		regions: "all",
	},
];

function applies(def: HolidayDef, region: GermanRegion): boolean {
	return def.regions === "all" || def.regions.includes(region);
}

/** Gesetzliche Feiertage für ein Jahr und ein Bundesland (leer bei "none"). */
export function germanHolidays(year: number, region: GermanRegion): Holiday[] {
	if (region === "none") return [];
	const easter = easterSunday(year);
	return HOLIDAY_DEFS.filter((def) => applies(def, region))
		.map((def) => ({ date: toDateKey(def.date(year, easter)), name: def.name }))
		.sort((a, b) => a.date.localeCompare(b.date));
}

export function isSupportedRegion(region: GermanRegion): boolean {
	return region !== "none" && ALL.includes(region);
}
