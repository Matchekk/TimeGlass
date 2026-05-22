import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { DayDetail } from "../components/DayDetail";
import { StatCard } from "../components/StatCard";
import { getCalendarGridDates, hasMonthStarted, isSameMonth } from "../lib/dateUtils";
import { formatDateSpoken, formatMinutes, formatMinutesOrDash, formatMinutesSpoken } from "../lib/formatting";
import { shouldShowDailyDelta, summarizePeriod } from "../lib/timeCalculations";
import type { AppData } from "../App";
import { findLeaveForDate, leaveTypeLabel } from "../lib/leaveCalculations";
import type { DaySummary } from "../types";

function calendarButtonLabel(
  dateKey: string,
  item: DaySummary | undefined,
  leaveLabel: string | null,
  selected: boolean,
  showDelta: boolean,
): string {
  return [
    formatDateSpoken(dateKey),
    leaveLabel ?? (item ? "Arbeitstag" : null),
    item ? `Netto ${formatMinutesSpoken(item.netMinutes)}` : null,
    showDelta && item && item.differenceMinutes != null ? `Differenz ${formatMinutesSpoken(item.differenceMinutes, true)}` : null,
    selected ? "ausgewählt" : null,
  ].filter(Boolean).join(", ");
}

export function MonthPage({
  data,
  refresh,
  monthDate,
  onMonthChange,
}: {
  data: AppData;
  refresh: () => Promise<void>;
  monthDate: Date;
  onMonthChange: (monthDate: Date) => void;
}) {
  const [selected, setSelected] = useState(data.today.date);
  const gridDates = getCalendarGridDates(monthDate);
  const monthIsVisible = hasMonthStarted(monthDate);
  const monthSummaries = monthIsVisible ? data.year.filter((day) => {
    const date = new Date(`${day.date}T00:00:00`);
    return date.getFullYear() === monthDate.getFullYear() && date.getMonth() === monthDate.getMonth();
  }) : [];
  const total = summarizePeriod(monthSummaries, { settings: data.settings, kind: "month" });
  const monthMap = new Map(monthSummaries.map((day) => [day.date, day]));
  const day = monthMap.get(selected) ?? monthSummaries[0] ?? data.today;
  const override = data.overrides.find((item) => item.date === day.date);
  const showDailyDelta = shouldShowDailyDelta(data.settings);
  const noTargetMode = data.settings.workModelMode === "no_target_tracking";

  useEffect(() => {
    const today = new Date(`${data.today.date}T00:00:00`);
    if (today.getFullYear() === monthDate.getFullYear() && today.getMonth() === monthDate.getMonth()) {
      setSelected(data.today.date);
      return;
    }
    setSelected(monthSummaries[0]?.date ?? data.today.date);
  }, [data.today.date, monthDate.getFullYear(), monthDate.getMonth()]);

  function shiftMonth(offset: number) {
    onMonthChange(new Date(monthDate.getFullYear(), monthDate.getMonth() + offset, 1));
  }

  return (
    <div className="page-stack">
      <div className="section-heading">
        <div>
          <span>Monat</span>
          <h1>{monthDate.toLocaleDateString("de-DE", { month: "long", year: "numeric" })}</h1>
        </div>
        <div className="month-nav" aria-label="Monat wechseln">
          <button className="icon-button" type="button" aria-label="Vorherigen Monat anzeigen" title="Vorheriger Monat" onClick={() => shiftMonth(-1)}>
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button className="icon-button" type="button" aria-label="Nächsten Monat anzeigen" title="Nächster Monat" onClick={() => shiftMonth(1)}>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="card-grid three">
        <StatCard label={noTargetMode ? "Arbeitszeit gesamt" : "Netto"} value={formatMinutes(total.netMinutes)} />
        {noTargetMode ? (
          <StatCard label="Soll" value="nicht aktiv" detail="Kein Monatsziel" tone="neutral" />
        ) : (
          <StatCard label="Soll" value={formatMinutesOrDash(total.targetMinutes)} />
        )}
        {noTargetMode ? (
          <StatCard label="Differenz" value="nicht aktiv" tone="neutral" />
        ) : (
          <StatCard
            label="Monatssumme"
            value={total.differenceMinutes != null ? formatMinutes(total.differenceMinutes, true) : "—"}
            tone={total.differenceMinutes != null && total.differenceMinutes >= 0 ? "positive" : "negative"}
          />
        )}
      </div>
      <section className="calendar-grid glass-panel">
        {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((label) => <span className="calendar-head" key={label}>{label}</span>)}
        {gridDates.map((dateKey) => {
          const item = monthMap.get(dateKey);
          const leave = findLeaveForDate(data.leaveEntries, dateKey);
          const leaveLabel = leave ? leaveTypeLabel(leave.type) : null;
          const outside = !isSameMonth(dateKey, monthDate);
          const selectedDay = selected === dateKey;
          const dayHasDelta = showDailyDelta && item && item.differenceMinutes != null;
          return (
            <button
              className={`calendar-day ${outside ? "outside" : ""} ${selectedDay ? "active" : ""} ${leave ? "has-leave" : ""}`}
              type="button"
              key={dateKey}
              aria-label={calendarButtonLabel(dateKey, item, leaveLabel, selectedDay, showDailyDelta)}
              onClick={() => setSelected(dateKey)}
            >
              <strong>{Number(dateKey.slice(8, 10))}</strong>
              {dayHasDelta ? (
                <span className={item!.differenceMinutes! >= 0 ? "positive-text" : "negative-text"}>
                  {formatMinutes(item!.differenceMinutes!, true)}
                  <small className={item!.differenceMinutes! >= 0 ? "delta-word positive-badge" : "delta-word negative-badge"}>{item!.differenceMinutes! >= 0 ? "Plus" : "Minus"}</small>
                </span>
              ) : item ? (
                <span className="muted-text">{formatMinutes(item.netMinutes)}</span>
              ) : null}
              {selectedDay && <small className="state-badge">Ausgewählt</small>}
              {leaveLabel && <small className="state-badge leave-badge">{leaveLabel}</small>}
            </button>
          );
        })}
      </section>
      <DayDetail day={day} entries={data.entries} override={override} onChanged={refresh} />
    </div>
  );
}
