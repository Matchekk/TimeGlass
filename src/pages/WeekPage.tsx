import { DayDetail } from "../components/DayDetail";
import { DiffValue, StatCard } from "../components/StatCard";
import { formatDate, formatMinutes } from "../lib/formatting";
import { summarizePeriod } from "../lib/timeCalculations";
import type { AppData } from "../App";
import { useState } from "react";

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
      <section className="glass-panel table-panel">
        {data.week.map((item) => (
          <button className={item.date === selected ? "day-line active" : "day-line"} key={item.date} onClick={() => setSelected(item.date)}>
            <strong>{formatDate(item.date)}</strong>
            <span>Netto {formatMinutes(item.netMinutes)}</span>
            <span>Soll {formatMinutes(item.targetMinutes)}</span>
            <DiffValue minutes={item.differenceMinutes} />
          </button>
        ))}
      </section>
      <DayDetail day={day} entries={data.entries} override={override} onChanged={refresh} />
    </div>
  );
}
