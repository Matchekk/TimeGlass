export function formatMinutes(totalMinutes: number, withSign = false): string {
  const sign = totalMinutes < 0 ? "-" : withSign && totalMinutes > 0 ? "+" : "";
  const abs = Math.abs(Math.round(totalMinutes));
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return `${sign}${hours}:${String(minutes).padStart(2, "0")}`;
}

export function formatMinutesSpoken(totalMinutes: number, withSign = false): string {
  const rounded = Math.round(totalMinutes);
  const sign = rounded < 0 ? "minus " : withSign && rounded > 0 ? "plus " : "";
  const abs = Math.abs(rounded);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? "Stunde" : "Stunden"}`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes} ${minutes === 1 ? "Minute" : "Minuten"}`);
  return `${sign}${parts.join(" ")}`;
}

export function formatClock(iso: string | null): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDate(dateKey: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(`${dateKey}T00:00:00`));
}

export function formatDateSpoken(dateKey: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${dateKey}T00:00:00`));
}

export function formatLongDate(dateKey: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${dateKey}T00:00:00`));
}

export function parseDurationToMinutes(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;
  const signed = trimmed.startsWith("-");
  const normalized = trimmed.replace(/^[+-]/, "");
  if (normalized.includes(":")) {
    const [hoursRaw, minutesRaw] = normalized.split(":");
    const hours = Number(hoursRaw);
    const minutes = Number(minutesRaw);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes < 0 || minutes > 59) return null;
    return (signed ? -1 : 1) * (hours * 60 + minutes);
  }
  const decimalHours = Number(normalized);
  if (!Number.isFinite(decimalHours)) return null;
  return Math.round((signed ? -1 : 1) * decimalHours * 60);
}

export function minutesToInput(totalMinutes: number | null | undefined): string {
  if (totalMinutes == null) return "";
  return formatMinutes(totalMinutes);
}
