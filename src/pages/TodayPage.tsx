import { DayDetail } from "../components/DayDetail";
import { DiffValue, StatCard } from "../components/StatCard";
import { formatClock, formatLongDate, formatMinutes, formatMinutesOrDash } from "../lib/formatting";
import { calculateTodayExitOptions, shouldShowDailyDelta } from "../lib/timeCalculations";
import type { AppData } from "../App";

export function TodayPage({ data, refresh }: { data: AppData; refresh: () => Promise<void> }) {
  const override = data.overrides.find((item) => item.date === data.today.date);
  const dayTypeLabels: Record<string, string> = {
    work: "Arbeitstag",
    free: "Arbeitsfrei (Soll 0)",
    sick: "Krank",
    vacation: "Urlaub",
    other: "Sonstiges",
  };
  const showDailyDelta = shouldShowDailyDelta(data.settings);
  const noDailyTarget = data.today.targetMinutes == null;
  const balanceBeforeToday = data.flexBalanceMinutes != null && data.today.differenceMinutes != null
    ? data.flexBalanceMinutes - data.today.differenceMinutes
    : null;
  const exitOptions = calculateTodayExitOptions({
    todayNetMinutes: data.today.netMinutes,
    todayTargetMinutes: data.today.targetMinutes,
    balanceBeforeTodayMinutes: balanceBeforeToday,
    isCurrentlyTracking: data.entries.some((entry) => !entry.end_time),
  });
  const hasAccountValue = exitOptions.currentBalanceIncludingTodayMinutes != null;
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
        {noDailyTarget ? (
          <StatCard label="Soll" value="Kein Tages-Soll" detail="in diesem Arbeitsmodell" tone="neutral" />
        ) : (
          <StatCard label="Soll" value={formatMinutesOrDash(data.today.targetMinutes)} />
        )}
        {showDailyDelta && !noDailyTarget ? (
          <StatCard
            label="Differenz"
            value={data.today.differenceMinutes != null ? formatMinutes(data.today.differenceMinutes, true) : "—"}
            tone={data.today.differenceMinutes != null && data.today.differenceMinutes >= 0 ? "positive" : "negative"}
            detail={<DiffValue minutes={data.today.differenceMinutes} />}
          />
        ) : (
          <StatCard label="Differenz" value="nicht aktiv" detail="Kein Tages-Soll in diesem Arbeitsmodell" tone="neutral" />
        )}
        <StatCard label="Tagesart" value={dayTypeLabels[data.today.dayType] ?? data.today.dayType} detail={data.today.note ?? undefined} />
      </div>
      {(!noDailyTarget || hasAccountValue) && (
        <div className="card-grid three">
          {!noDailyTarget && (
            <StatCard
              label="Rest bis Tages-Soll"
              value={exitOptions.remainingToDailyTargetMinutes != null ? formatMinutes(exitOptions.remainingToDailyTargetMinutes) : "—"}
              detail={exitOptions.dailyTargetReached ? "erreicht" : "noch offen"}
              tone={exitOptions.dailyTargetReached ? "positive" : "neutral"}
            />
          )}
          {hasAccountValue && (
            <StatCard
              label="Rest bis Konto 0"
              value={formatMinutes(exitOptions.remainingToZeroBalanceMinutes ?? 0)}
              detail={exitOptions.zeroBalanceReached ? "Konto bleibt mindestens 0" : "bis Gleitzeitkonto 0"}
              tone={exitOptions.zeroBalanceReached ? "positive" : "neutral"}
            />
          )}
          {hasAccountValue && (
            <StatCard
              label="Gleitzeit inkl. heute"
              value={formatMinutes(exitOptions.currentBalanceIncludingTodayMinutes ?? 0, true)}
              detail={exitOptions.coveredByFlexMinutes != null && exitOptions.coveredByFlexMinutes > 0 ? `Gleitzeit deckt ${formatMinutes(exitOptions.coveredByFlexMinutes)} ab` : undefined}
              tone={(exitOptions.currentBalanceIncludingTodayMinutes ?? 0) >= 0 ? "positive" : "negative"}
            />
          )}
        </div>
      )}
      <DayDetail day={data.today} entries={data.entries} override={override} onChanged={refresh} />
    </div>
  );
}
