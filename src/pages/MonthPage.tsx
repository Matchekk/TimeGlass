import { useState } from "react";
import { DayDetail } from "../components/DayDetail";
import { StatCard } from "../components/StatCard";
import { getCalendarGridDates, isSameMonth } from "../lib/dateUtils";
import { formatMinutes } from "../lib/formatting";
import { summarizePeriod } from "../lib/timeCalculations";
import type { AppData } from "../App";

export function MonthPage({ data, refresh }: { data: AppData; refresh: () => Promise<void> }) {
  const today = new Date();
  const [selected, setSelected] = useState(data.today.date);
  const total = summarizePeriod(data.month);
  const gridDates = getCalendarGridDates(today);
  const monthMap = new Map(data.month.map((day) => [day.date, day]));
  const day = monthMap.get(selected) ?? data.today;
  const override = data.overrides.find((item) => item.date === day.date);

  return (
    <div className="page-stack">
      <div className="section-heading">
        <div>
          <span>Monat</span>
          <h1>{today.toLocaleDateString("de-DE", { month: "long", year: "numeric" })}</h1>
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
          const outside = !isSameMonth(dateKey, today);
          return (
            <button className={`calendar-day ${outside ? "outside" : ""} ${selected === dateKey ? "active" : ""}`} key={dateKey} onClick={() => setSelected(dateKey)}>
              <strong>{Number(dateKey.slice(8, 10))}</strong>
              {item && <span className={item.differenceMinutes >= 0 ? "positive-text" : "negative-text"}>{formatMinutes(item.differenceMinutes, true)}</span>}
            </button>
          );
        })}
      </section>
      <DayDetail day={day} entries={data.entries} override={override} onChanged={refresh} />
    </div>
  );
}
