import { StatCard } from "../components/StatCard";
import { getMonthDates } from "../lib/dateUtils";
import { formatMinutes } from "../lib/formatting";
import { summarizePeriod } from "../lib/timeCalculations";
import type { AppData } from "../App";

export function YearPage({ data }: { data: AppData; refresh: () => Promise<void> }) {
  const now = new Date();
  const total = summarizePeriod(data.year);
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
          const summary = summarizePeriod(summaries);
          return (
            <article className="glass-card month-card" key={month}>
              <span>{date.toLocaleDateString("de-DE", { month: "long" })}</span>
              <strong className={summary.differenceMinutes >= 0 ? "positive-text" : "negative-text"}>{formatMinutes(summary.differenceMinutes, true)}</strong>
              <small>{formatMinutes(summary.netMinutes)} netto</small>
            </article>
          );
        })}
      </section>
    </div>
  );
}
