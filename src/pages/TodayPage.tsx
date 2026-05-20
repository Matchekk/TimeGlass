import { DayDetail } from "../components/DayDetail";
import { DiffValue, StatCard } from "../components/StatCard";
import { formatClock, formatLongDate, formatMinutes } from "../lib/formatting";
import type { AppData } from "../App";

export function TodayPage({ data, refresh }: { data: AppData; refresh: () => Promise<void> }) {
  const override = data.overrides.find((item) => item.date === data.today.date);
  return (
    <div className="page-stack">
      <div className="section-heading">
        <div>
          <span>Heute</span>
          <h1>{formatLongDate(data.today.date)}</h1>
        </div>
      </div>
      <div className="card-grid">
        <StatCard label="Erstes Einstempeln" value={formatClock(data.today.firstStart)} />
        <StatCard label="Letztes Ausstempeln" value={formatClock(data.today.lastEnd)} />
        <StatCard label="Brutto" value={formatMinutes(data.today.grossMinutes)} />
        <StatCard label="Pause" value={formatMinutes(data.today.breakMinutes)} />
        <StatCard label="Netto" value={formatMinutes(data.today.netMinutes)} />
        <StatCard label="Soll" value={formatMinutes(data.today.targetMinutes)} />
        <StatCard label="Differenz" value={formatMinutes(data.today.differenceMinutes, true)} tone={data.today.differenceMinutes >= 0 ? "positive" : "negative"} />
        <StatCard label="Tagesart" value={data.today.dayType} detail={data.today.note ?? undefined} />
      </div>
      <DayDetail day={data.today} entries={data.entries} override={override} onChanged={refresh} />
    </div>
  );
}
