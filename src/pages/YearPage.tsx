import { StatCard } from "../components/StatCard";
import { getMonthDates, hasMonthStarted } from "../lib/dateUtils";
import { formatMinutes, formatMinutesSpoken } from "../lib/formatting";
import { summarizePeriod } from "../lib/timeCalculations";
import type { AppData } from "../App";

export function YearPage({ data, onMonthSelect }: { data: AppData; refresh: () => Promise<void>; onMonthSelect: (monthDate: Date) => void }) {
  const now = new Date();
  const visibleYearDays = data.year.filter((day) => hasMonthStarted(new Date(`${day.date}T00:00:00`), now));
  const total = summarizePeriod(visibleYearDays);
  return (
    <div className="page-stack">
      <div className="section-heading">
        <div>
          <span>Jahr</span>
          <h1>{now.getFullYear()}</h1>
        </div>
      </div>
      <div className="card-grid three">
        <StatCard label="Netto" value={formatMinutes(total.netMinutes)} />
        <StatCard label="Soll" value={formatMinutes(total.targetMinutes)} />
        <StatCard label="Jahressumme" value={formatMinutes(total.differenceMinutes, true)} tone={total.differenceMinutes >= 0 ? "positive" : "negative"} />
      </div>
      <section className="month-card-grid">
        {Array.from({ length: 12 }, (_, month) => {
          const date = new Date(now.getFullYear(), month, 1);
          const keys = getMonthDates(date);
          const summaries = data.year.filter((day) => keys.includes(day.date));
          const started = hasMonthStarted(date, now);
          const summary = started ? summarizePeriod(summaries) : { netMinutes: 0, targetMinutes: 0, differenceMinutes: 0 };
          const monthLabel = date.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
          const status = started ? `Monatsdifferenz ${formatMinutesSpoken(summary.differenceMinutes, true)}` : "Monat noch nicht gestartet";
          return (
            <button
              className="glass-card month-card month-card-button"
              type="button"
              key={month}
              aria-label={`${monthLabel} öffnen, ${status}`}
              onClick={() => onMonthSelect(date)}
            >
              <span>{date.toLocaleDateString("de-DE", { month: "long" })}</span>
              <strong className={summary.differenceMinutes >= 0 ? "positive-text" : "negative-text"}>{formatMinutes(summary.differenceMinutes, true)}</strong>
              <small>{started ? `${formatMinutes(summary.netMinutes)} netto` : "Noch nicht gestartet"}</small>
              {started && <small className="state-badge">{summary.differenceMinutes >= 0 ? "Plus" : "Minus"}</small>}
            </button>
          );
        })}
      </section>
    </div>
  );
}
