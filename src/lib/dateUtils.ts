export const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfLocalDay(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function toDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fromDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function getWeekStart(date = new Date()): Date {
  const start = startOfLocalDay(date);
  const day = start.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addDays(start, mondayOffset);
}

export function getWeekDates(date = new Date()): string[] {
  const monday = getWeekStart(date);
  return Array.from({ length: 7 }, (_, index) => toDateKey(addDays(monday, index)));
}

export function getMonthDates(date = new Date()): string[] {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return Array.from({ length: last.getDate() }, (_, index) => toDateKey(addDays(first, index)));
}

export function getYearDates(year = new Date().getFullYear()): string[] {
  const first = new Date(year, 0, 1);
  const last = new Date(year, 11, 31);
  const days = Math.round((last.getTime() - first.getTime()) / DAY_MS) + 1;
  return Array.from({ length: days }, (_, index) => toDateKey(addDays(first, index)));
}

export function getCalendarGridDates(date = new Date()): string[] {
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const gridStart = getWeekStart(monthStart);
  const endDay = monthEnd.getDay();
  const sundayOffset = endDay === 0 ? 0 : 7 - endDay;
  const gridEnd = addDays(monthEnd, sundayOffset);
  const days = Math.round((gridEnd.getTime() - gridStart.getTime()) / DAY_MS) + 1;
  return Array.from({ length: days }, (_, index) => toDateKey(addDays(gridStart, index)));
}

export function isSameMonth(dateKey: string, month: Date): boolean {
  const date = fromDateKey(dateKey);
  return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();
}

export function dateTimeLocalValue(iso: string): string {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function localInputToIso(value: string): string {
  return new Date(value).toISOString();
}

export function dateRangeForKeys(dateKeys: string[]): { startIso: string; endIso: string } {
  const sorted = [...dateKeys].sort();
  const start = fromDateKey(sorted[0]);
  const end = addDays(fromDateKey(sorted[sorted.length - 1]), 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}
