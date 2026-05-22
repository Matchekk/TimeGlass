import { useEffect, useMemo, useState } from "react";
import { PrimaryPunchButton } from "../components/PrimaryPunchButton";
import { DiffValue, StatCard } from "../components/StatCard";
import { formatClock, formatMinutes, formatMinutesOrDash, parseDurationToMinutes } from "../lib/formatting";
import {
  calculateTodayExitOptions,
  calculateTotalTrackedTime,
  isLongActiveSession,
  shouldShowDailyDelta,
  shouldShowOvertimeBalance,
  summarizePeriod,
} from "../lib/timeCalculations";
import type { AppData, Page } from "../App";
import { saveDayOverride } from "../db/timeEntries";
import { setSetting } from "../db/settings";
import { findSuspiciousDays } from "../lib/dataQuality";

export function DashboardPage({ data, refresh, navigate }: { data: AppData; refresh: () => Promise<void>; navigate: (page: Page) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [desiredPlus, setDesiredPlus] = useState(() => formatMinutes(data.settings.desiredBalanceMinutes));
  useEffect(() => {
    setDesiredPlus(formatMinutes(data.settings.desiredBalanceMinutes));
  }, [data.settings.desiredBalanceMinutes]);
  const activeEntry = data.entries.find((entry) => !entry.end_time) ?? null;
  const week = useMemo(() => summarizePeriod(data.week, { settings: data.settings, kind: "week" }), [data.week, data.settings]);
  const month = useMemo(() => summarizePeriod(data.month, { settings: data.settings, kind: "month" }), [data.month, data.settings]);
  const year = useMemo(() => summarizePeriod(data.year, { settings: data.settings, kind: "year" }), [data.year, data.settings]);
  const totalTracked = useMemo(() => calculateTotalTrackedTime(data.allDays), [data.allDays]);
  const desiredPlusMinutes = parseDurationToMinutes(desiredPlus) ?? data.settings.desiredBalanceMinutes;

  async function persistDesiredPlus() {
    const parsed = parseDurationToMinutes(desiredPlus);
    if (parsed == null) {
      setDesiredPlus(formatMinutes(data.settings.desiredBalanceMinutes));
      return;
    }
    const sanitized = Math.max(0, Math.round(parsed));
    if (sanitized === data.settings.desiredBalanceMinutes) {
      setDesiredPlus(formatMinutes(sanitized));
      return;
    }
    try {
      await setSetting("desired_balance_minutes", String(sanitized));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Konto-Plus konnte nicht gespeichert werden.");
    }
  }
  const balanceBeforeToday = data.flexBalanceMinutes != null && data.today.differenceMinutes != null
    ? data.flexBalanceMinutes - data.today.differenceMinutes
    : null;
  const exitOptions = useMemo(
    () => calculateTodayExitOptions({
      todayNetMinutes: data.today.netMinutes,
      todayTargetMinutes: data.today.targetMinutes,
      balanceBeforeTodayMinutes: balanceBeforeToday,
      desiredBalanceMinutes: desiredPlusMinutes,
      isCurrentlyTracking: Boolean(activeEntry),
    }),
    [activeEntry, balanceBeforeToday, data.today.netMinutes, data.today.targetMinutes, desiredPlusMinutes],
  );
  const suspiciousDays = useMemo(
    () => findSuspiciousDays(data.allDays.length ? data.allDays : [data.today], data.entries, data.settings).slice(0, 4),
    [data.allDays, data.entries, data.settings, data.today],
  );

  const showDailyDelta = shouldShowDailyDelta(data.settings);
  const showOvertimeBalance = shouldShowOvertimeBalance(data.settings);
  const noTargetMode = data.settings.workModelMode === "no_target_tracking";
  const variableWeeklyMode = data.settings.workModelMode === "variable_weekly_target";
  const hasDailyTarget = exitOptions.remainingToDailyTargetMinutes != null;
  const hasAccountValue = exitOptions.currentBalanceIncludingTodayMinutes != null;
  const showExitPanel = Boolean(activeEntry) && hasDailyTarget;
  const weekRemaining = week.targetMinutes != null ? Math.max(0, week.targetMinutes - week.netMinutes) : null;

  async function markTodayFree() {
    const confirmed = window.confirm("Heute wirklich als arbeitsfrei setzen?\nDie Sollzeit für heute wird auf 0 gesetzt.");
    if (!confirmed) return;
    await saveDayOverride({
      date: data.today.date,
      manual_break_minutes: null,
      target_minutes: 0,
      day_type: "free",
      note: data.today.note,
    });
    await refresh();
  }

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

      <div className="card-grid dashboard-grid">
        <StatCard
          label="Status"
          value={activeEntry ? "Eingestempelt" : "Ausgestempelt"}
          detail={activeEntry ? formatClock(activeEntry.start_time) : "Keine aktive Session"}
          tone={activeEntry ? "positive" : "neutral"}
        />
        <StatCard
          label={noTargetMode ? "Heute gearbeitet" : "Heute"}
          value={formatMinutes(data.today.netMinutes)}
          detail={showDailyDelta ? <DiffValue minutes={data.today.differenceMinutes} /> : "Nettozeit"}
          tone={showDailyDelta && data.today.differenceMinutes != null ? (data.today.differenceMinutes >= 0 ? "positive" : "negative") : "neutral"}
        />
        <StatCard
          label={noTargetMode ? "Diese Woche gearbeitet" : "Diese Woche"}
          value={formatMinutes(week.netMinutes)}
          detail={
            noTargetMode
              ? "Nettozeit"
              : variableWeeklyMode
                ? `Wochenziel ${formatMinutesOrDash(week.targetMinutes)}`
                : <DiffValue minutes={week.differenceMinutes} />
          }
          tone={week.differenceMinutes != null ? (week.differenceMinutes >= 0 ? "positive" : "negative") : "neutral"}
        />
        <StatCard
          label={noTargetMode ? "Dieser Monat gearbeitet" : "Dieser Monat"}
          value={formatMinutes(month.netMinutes)}
          detail={
            noTargetMode
              ? "Nettozeit"
              : <DiffValue minutes={month.differenceMinutes} />
          }
          tone={month.differenceMinutes != null ? (month.differenceMinutes >= 0 ? "positive" : "negative") : "neutral"}
        />
        <StatCard
          label={noTargetMode ? "Dieses Jahr gearbeitet" : "Dieses Jahr"}
          value={formatMinutes(year.netMinutes)}
          detail={
            noTargetMode
              ? "Nettozeit"
              : <DiffValue minutes={year.differenceMinutes} />
          }
          tone={year.differenceMinutes != null ? (year.differenceMinutes >= 0 ? "positive" : "negative") : "neutral"}
        />
        {noTargetMode ? (
          <StatCard
            label="Gesamt erfasst"
            value={formatMinutes(totalTracked)}
            detail="seit erstem Eintrag"
            tone="neutral"
          />
        ) : showOvertimeBalance && data.flexBalanceMinutes != null ? (
          <StatCard
            label="Gleitzeitkonto"
            value={formatMinutes(data.flexBalanceMinutes, true)}
            detail="seit Beginn der Aufzeichnung"
            tone={data.flexBalanceMinutes >= 0 ? "positive" : "negative"}
          />
        ) : (
          <StatCard
            label="Gleitzeitkonto"
            value="nicht aktiv"
            detail="Für dieses Arbeitsmodell deaktiviert."
            tone="neutral"
          />
        )}
      </div>

      {variableWeeklyMode && week.targetMinutes != null && (
        <section className="glass-panel leave-calculator" aria-label="Wochenfortschritt">
          <div>
            <span className="eyebrow">Wochenfortschritt</span>
            <h2>{weekRemaining === 0 ? "Wochenziel erreicht" : "Wochenziel offen"}</h2>
          </div>
          <div className="leave-calculator-grid">
            <div className="glass-card leave-mini-card">
              <span>Wochenziel</span>
              <strong>{formatMinutes(week.targetMinutes)}</strong>
              <small>nach Arbeitsmodell</small>
            </div>
            <div className="glass-card leave-mini-card">
              <span>Bisher diese Woche</span>
              <strong>{formatMinutes(week.netMinutes)}</strong>
              <small>Nettozeit</small>
            </div>
            <div className={`glass-card leave-mini-card ${weekRemaining === 0 ? "positive" : ""}`}>
              <span>Wochenrest</span>
              <strong>{weekRemaining != null ? formatMinutes(weekRemaining) : "—"}</strong>
              <small>bis zum Wochenziel</small>
            </div>
          </div>
        </section>
      )}

      {showExitPanel && (
        <section className="glass-panel leave-calculator" aria-label="Wann kann ich gehen">
          <div>
            <span className="eyebrow">Wann kann ich gehen?</span>
            <h2>
              {hasAccountValue && exitOptions.zeroBalanceReached
                ? "Gleitzeitkonto bleibt mindestens bei 0"
                : exitOptions.dailyTargetReached
                  ? "Tages-Soll erreicht"
                  : "Tages-Soll noch offen"}
            </h2>
            {hasAccountValue && exitOptions.coveredByFlexMinutes != null && exitOptions.coveredByFlexMinutes > 0 && (
              <p className="muted">
                Gleitzeit deckt heute bis zu {formatMinutes(exitOptions.coveredByFlexMinutes)} ab.
              </p>
            )}
          </div>
          <div className="leave-calculator-grid">
            <div className={`glass-card leave-mini-card ${exitOptions.dailyTargetReached ? "positive" : ""}`}>
              <span>Rest bis Tages-Soll</span>
              <strong>{exitOptions.remainingToDailyTargetMinutes != null ? formatMinutes(exitOptions.remainingToDailyTargetMinutes) : "—"}</strong>
              <small>Netto {formatMinutes(data.today.netMinutes)}</small>
            </div>
            {hasAccountValue ? (
              <div className={`glass-card leave-mini-card ${exitOptions.zeroBalanceReached ? "positive" : ""}`}>
                <span>Rest bis Konto 0</span>
                <strong>{formatMinutes(exitOptions.remainingToZeroBalanceMinutes ?? 0)}</strong>
                <small>
                  Feierabend {exitOptions.exitAtZeroBalance ? formatClock(exitOptions.exitAtZeroBalance.toISOString()) : "—"}
                </small>
              </div>
            ) : (
              <div className="glass-card leave-mini-card">
                <span>Gleitzeitkonto</span>
                <strong>nicht aktiv</strong>
                <small>Im aktuellen Arbeitsmodell deaktiviert.</small>
              </div>
            )}
            <div className="glass-card leave-mini-card leave-plus-card">
              <label>
                Gewünschtes Konto-Plus
                <input
                  value={desiredPlus}
                  onChange={(event) => setDesiredPlus(event.target.value)}
                  onBlur={() => void persistDesiredPlus()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      (event.target as HTMLInputElement).blur();
                    }
                  }}
                  inputMode="numeric"
                  aria-describedby="desired-plus-help"
                />
              </label>
              <strong>
                {hasAccountValue && exitOptions.exitAtDesiredBalance
                  ? formatClock(exitOptions.exitAtDesiredBalance.toISOString())
                  : "—"}
              </strong>
              <small id="desired-plus-help">
                {hasAccountValue
                  ? exitOptions.remainingToDesiredBalanceMinutes != null
                    ? `Rest ${formatMinutes(exitOptions.remainingToDesiredBalanceMinutes)} bis ${formatMinutes(desiredPlusMinutes, true)}`
                    : "—"
                  : "Gleitzeitkonto nicht aktiv"}
              </small>
            </div>
          </div>
          {hasAccountValue && (
            <p className="muted" aria-live="polite">
              Aktuelles Gleitzeitkonto inklusive heute: {formatMinutes(exitOptions.currentBalanceIncludingTodayMinutes ?? 0, true)}
            </p>
          )}
        </section>
      )}

      {activeEntry && !showExitPanel && !variableWeeklyMode && (
        <section className="glass-panel leave-calculator" aria-label="Hinweis Tagesziel">
          <div>
            <span className="eyebrow">Wann kann ich gehen?</span>
            <h2>Für dieses Arbeitsmodell ist kein Sollziel hinterlegt.</h2>
            <p className="muted">TimeGlass erfasst in diesem Modell nur die gearbeitete Zeit. Über- und Unterstunden werden nicht berechnet.</p>
          </div>
        </section>
      )}

      {suspiciousDays.length > 0 && (
        <section className="glass-panel quality-panel">
          <div>
            <span className="eyebrow">Auffällige Tage</span>
            <h2>Bitte kurz prüfen</h2>
          </div>
          {suspiciousDays.map((issue) => (
            <button className="quality-line" type="button" key={`${issue.type}-${issue.date}`} onClick={() => navigate("today")}>
              <strong>{issue.date}</strong>
              <span>{issue.message}</span>
            </button>
          ))}
        </section>
      )}

      <section className="glass-panel quick-actions" aria-label="Schnellaktionen">
        <button className="secondary-button" type="button" onClick={() => navigate("today")}>Heute korrigieren</button>
        <button className="secondary-button" type="button" onClick={() => navigate("today")}>Pause eintragen</button>
        <button className="secondary-button" type="button" onClick={() => navigate("leave")}>Urlaub eintragen</button>
        <button className="secondary-button" type="button" onClick={() => navigate("today")}>Notiz für heute</button>
        <button className="secondary-button" type="button" onClick={() => navigate("today")}>Letzte Session bearbeiten</button>
        {!noTargetMode && (
          <button
            className="secondary-button danger-soft"
            type="button"
            onClick={() => void markTodayFree()}
          >
            Heute arbeitsfrei setzen (Soll 0)
          </button>
        )}
      </section>
    </div>
  );
}
