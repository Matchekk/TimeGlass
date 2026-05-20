import { useMemo, useState } from "react";
import { PrimaryPunchButton } from "../components/PrimaryPunchButton";
import { DiffValue, StatCard } from "../components/StatCard";
import { formatClock, formatMinutes } from "../lib/formatting";
import { isLongActiveSession, summarizePeriod } from "../lib/timeCalculations";
import type { AppData, Page } from "../App";
import { saveDayOverride } from "../db/timeEntries";

export function DashboardPage({ data, refresh, navigate }: { data: AppData; refresh: () => Promise<void>; navigate: (page: Page) => void }) {
  const [error, setError] = useState<string | null>(null);
  const activeEntry = data.entries.find((entry) => !entry.end_time) ?? null;
  const week = useMemo(() => summarizePeriod(data.week), [data.week]);
  const month = useMemo(() => summarizePeriod(data.month), [data.month]);
  const year = useMemo(() => summarizePeriod(data.year), [data.year]);

  return (
    <div className="page-stack">
      <header className="hero glass-panel">
        <div>
          <span className="eyebrow">{activeEntry ? "Eingestempelt" : "Ausgestempelt"}</span>
          <h1>{activeEntry ? `Heute aktiv seit ${formatClock(activeEntry.start_time)}` : "Bereit für den Tag"}</h1>
          <p>{activeEntry ? `Aktuelle Session: ${formatMinutes(data.today.grossMinutes)} brutto mit laufender Zeit` : "Private Übersicht, offline und lokal gespeichert."}</p>
          {isLongActiveSession(activeEntry, data.settings.unusualSessionMinutes) && (
            <div className="inline-warning">Die aktive Session läuft ungewöhnlich lang. Keine Korrektur wurde automatisch vorgenommen.</div>
          )}
          {error && <div className="inline-error">{error}</div>}
        </div>
        <PrimaryPunchButton activeEntry={activeEntry} onDone={refresh} onError={setError} />
      </header>

      <div className="card-grid">
        <StatCard label="Status" value={activeEntry ? "Eingestempelt" : "Ausgestempelt"} detail={activeEntry ? formatClock(activeEntry.start_time) : "Keine aktive Session"} tone={activeEntry ? "positive" : "neutral"} />
        <StatCard label="Heute" value={formatMinutes(data.today.netMinutes)} detail={<DiffValue minutes={data.today.differenceMinutes} />} tone={data.today.differenceMinutes >= 0 ? "positive" : "negative"} />
        <StatCard label="Diese Woche" value={formatMinutes(week.netMinutes)} detail={<DiffValue minutes={week.differenceMinutes} />} tone={week.differenceMinutes >= 0 ? "positive" : "negative"} />
        <StatCard label="Dieser Monat" value={formatMinutes(month.netMinutes)} detail={<DiffValue minutes={month.differenceMinutes} />} tone={month.differenceMinutes >= 0 ? "positive" : "negative"} />
        <StatCard label="Dieses Jahr" value={formatMinutes(year.netMinutes)} detail={<DiffValue minutes={year.differenceMinutes} />} tone={year.differenceMinutes >= 0 ? "positive" : "negative"} />
        <StatCard label="Gleitzeitkonto" value={formatMinutes(data.flexBalanceMinutes, true)} detail="seit Beginn der Aufzeichnung" tone={data.flexBalanceMinutes >= 0 ? "positive" : "negative"} />
      </div>

      <section className="glass-panel quick-actions">
        <button className="secondary-button" onClick={() => navigate("today")}>Heute korrigieren</button>
        <button className="secondary-button" onClick={() => navigate("today")}>Pause eintragen</button>
        <button className="secondary-button" onClick={() => navigate("leave")}>Urlaub eintragen</button>
        <button className="secondary-button" onClick={() => navigate("today")}>Notiz für heute</button>
        <button className="secondary-button" onClick={() => navigate("today")}>Letzte Session bearbeiten</button>
        <button
          className="secondary-button"
          onClick={() => void saveDayOverride({
            date: data.today.date,
            manual_break_minutes: null,
            target_minutes: 0,
            day_type: "free",
            note: data.today.note,
          }).then(refresh)}
        >
          Heute als frei markieren
        </button>
      </section>
    </div>
  );
}
