import { DayDetail } from "../components/DayDetail";
import { DiffValue, StatCard } from "../components/StatCard";
import { formatDate, formatDateSpoken, formatMinutes, formatMinutesSpoken } from "../lib/formatting";
import { summarizePeriod } from "../lib/timeCalculations";
import type { AppData } from "../App";
import { useState } from "react";
import { findLeaveForDate, leaveTypeLabel } from "../lib/leaveCalculations";

function dayButtonLabel(item: AppData["week"][number], leaveLabel: string | null, selected: boolean): string {
  return [
    formatDateSpoken(item.date),
    `Netto ${formatMinutesSpoken(item.netMinutes)}`,
    `Soll ${formatMinutesSpoken(item.targetMinutes)}`,
    `Differenz ${formatMinutesSpoken(item.differenceMinutes, true)}`,
    leaveLabel ? `Abwesenheit ${leaveLabel}` : null,
    selected ? "ausgewählt" : null,
  ].filter(Boolean).join(", ");
}

function isConfiguredFreeDay(date: Date, data: AppData, leaveLabel: string | null): boolean {
  return !leaveLabel && !data.settings.workdays.includes(date.getDay());
}

export function WeekPage({ data, refresh }: { data: AppData; refresh: () => Promise<void> }) {
  const [selected, setSelected] = useState(data.today.date);
  const total = summarizePeriod(data.week);
  const day = data.week.find((item) => item.date === selected) ?? data.week[0];
  const override = data.overrides.find((item) => item.date === day.date);

  return (
    <div className="page-stack">
      <div className="section-heading">
        <div>
          <span>Woche</span>
          <h1>Montag bis Sonntag</h1>
        </div>
      </div>
      <div className="card-grid three">
        <StatCard label="Netto" value={formatMinutes(total.netMinutes)} />
        <StatCard label="Soll" value={formatMinutes(total.targetMinutes)} />
        <StatCard label="Wochensumme" value={formatMinutes(total.differenceMinutes, true)} tone={total.differenceMinutes >= 0 ? "positive" : "negative"} />
      </div>
      <section className="week-calendar glass-panel">
        {data.week.map((item) => {
          const leave = findLeaveForDate(data.leaveEntries, item.date);
          const leaveLabel = leave ? leaveTypeLabel(leave.type) : null;
          const date = new Date(`${item.date}T00:00:00`);
          const selectedDay = item.date === selected;
          const configuredFreeDay = isConfiguredFreeDay(date, data, leaveLabel);
          const statusLabel = leaveLabel ?? (configuredFreeDay ? "Frei" : null);
          return (
            <button
              type="button"
              className={`week-day-card ${selectedDay ? "active" : ""} ${leave ? "has-leave" : ""}`}
              key={item.date}
              aria-label={dayButtonLabel(item, statusLabel, selectedDay)}
              onClick={() => setSelected(item.date)}
            >
              <span>{date.toLocaleDateString("de-DE", { weekday: "short" })}</span>
              <strong>{date.getDate()}</strong>
              <small>{formatMinutes(item.netMinutes)} / {formatMinutes(item.targetMinutes)}</small>
              <em className={item.differenceMinutes >= 0 ? "positive-text" : "negative-text"}>{formatMinutes(item.differenceMinutes, true)}</em>
              <small className={item.differenceMinutes >= 0 ? "state-badge positive-badge" : "state-badge negative-badge"}>
                {item.differenceMinutes >= 0 ? "Plus" : "Minus"}
              </small>
              {selectedDay && <small className="state-badge">Ausgewählt</small>}
              {configuredFreeDay && <b className="state-badge leave-badge">Frei</b>}
              {leaveLabel && <b className="state-badge leave-badge">{leaveLabel}</b>}
            </button>
          );
        })}
      </section>
      <section className="glass-panel table-panel">
        {data.week.map((item) => {
          const leave = findLeaveForDate(data.leaveEntries, item.date);
          const leaveLabel = leave ? leaveTypeLabel(leave.type) : null;
          const date = new Date(`${item.date}T00:00:00`);
          const configuredFreeDay = isConfiguredFreeDay(date, data, leaveLabel);
          const statusLabel = leaveLabel ?? (configuredFreeDay ? "Frei" : null);
          return (
            <button
              className={item.date === selected ? "day-line active" : "day-line"}
              type="button"
              key={item.date}
              aria-label={dayButtonLabel(item, statusLabel, item.date === selected)}
              onClick={() => setSelected(item.date)}
            >
              <strong>{formatDate(item.date)}</strong>
              <span>Netto {formatMinutes(item.netMinutes)}</span>
              <span>Soll {formatMinutes(item.targetMinutes)}</span>
              <DiffValue minutes={item.differenceMinutes} />
            </button>
          );
        })}
      </section>
      <DayDetail day={day} entries={data.entries} override={override} onChanged={refresh} />
    </div>
  );
}
