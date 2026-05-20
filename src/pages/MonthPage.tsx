import { useEffect, useState } from "react";
import { DayDetail } from "../components/DayDetail";
import { StatCard } from "../components/StatCard";
import { getCalendarGridDates, hasMonthStarted, isSameMonth } from "../lib/dateUtils";
import { formatMinutes } from "../lib/formatting";
import { summarizePeriod } from "../lib/timeCalculations";
import type { AppData } from "../App";
import { findLeaveForDate, leaveTypeLabel } from "../lib/leaveCalculations";

export function MonthPage({ data, refresh, monthDate }: { data: AppData; refresh: () => Promise<void>; monthDate: Date }) {
  const [selected, setSelected] = useState(data.today.date);
  const gridDates = getCalendarGridDates(monthDate);
  const monthIsVisible = hasMonthStarted(monthDate);
  const monthSummaries = monthIsVisible ? data.year.filter((day) => {
    const date = new Date(`${day.date}T00:00:00`);
    return date.getFullYear() === monthDate.getFullYear() && date.getMonth() === monthDate.getMonth();
  }) : [];
  const total = summarizePeriod(monthSummaries);
  const monthMap = new Map(monthSummaries.map((day) => [day.date, day]));
  const day = monthMap.get(selected) ?? monthSummaries[0] ?? data.today;
  const override = data.overrides.find((item) => item.date === day.date);

  useEffect(() => {
    const today = new Date(`${data.today.date}T00:00:00`);
    if (today.getFullYear() === monthDate.getFullYear() && today.getMonth() === monthDate.getMonth()) {
      setSelected(data.today.date);
      return;
    }
    setSelected(monthSummaries[0]?.date ?? data.today.date);
  }, [data.today.date, monthDate.getFullYear(), monthDate.getMonth()]);

  return (
    <div className="page-stack">
      <div className="section-heading">
        <div>
          <span>Monat</span>
          <h1>{monthDate.toLocaleDateString("de-DE", { month: "long", year: "numeric" })}</h1>
        </div>
      </div>
      <div className="card-grid three">
        <StatCard label="Netto" value={formatMinutes(total.netMinutes)} />
        <StatCard label="Soll" value={formatMinutes(total.targetMinutes)} />
        <StatCard label="Monatssumme" value={formatMinutes(total.differenceMinutes, true)} tone={total.differenceMinutes >= 0 ? "positive" : "negative"} />
      </div>
      <section className="calendar-grid glass-panel">
        {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((label) => <span className="calendar-head" key={label}>{label}</span>)}
        {gridDates.map((dateKey) => {
          const item = monthMap.get(dateKey);
          const leave = findLeaveForDate(data.leaveEntries, dateKey);
          const outside = !isSameMonth(dateKey, monthDate);
          return (
            <button className={`calendar-day ${outside ? "outside" : ""} ${selected === dateKey ? "active" : ""} ${leave ? "has-leave" : ""}`} key={dateKey} onClick={() => setSelected(dateKey)}>
              <strong>{Number(dateKey.slice(8, 10))}</strong>
              {item && <span className={item.differenceMinutes >= 0 ? "positive-text" : "negative-text"}>{formatMinutes(item.differenceMinutes, true)}</span>}
              {leave && <small>{leaveTypeLabel(leave.type)}</small>}
            </button>
          );
        })}
      </section>
      <DayDetail day={day} entries={data.entries} override={override} onChanged={refresh} />
    </div>
  );
}
