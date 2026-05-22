import type { DaySummary, Settings, TimeEntry } from "../types";
import { isLongActiveSession } from "./timeCalculations";

export interface ReminderState {
  targetReachedDate?: string;
  longSessionDate?: string;
  clockOutDate?: string;
  noTimeDate?: string;
}

export interface ReminderDecision {
  key: keyof ReminderState;
  title: string;
  body: string;
}

export function resetReminderStateForNewSession(date: string): void {
  const state = JSON.parse(localStorage.getItem("timeglass.reminderState") ?? "{}") as ReminderState;
  const nextState = { ...state };
  for (const key of Object.keys(nextState) as Array<keyof ReminderState>) {
    if (nextState[key] === date) delete nextState[key];
  }
  localStorage.setItem("timeglass.reminderState", JSON.stringify(nextState));
}

function isAfterClock(time: string, now: Date): boolean {
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return false;
  const target = new Date(now);
  target.setHours(hours, minutes, 0, 0);
  return now >= target;
}

export function getReminderDecisions(
  settings: Settings,
  today: DaySummary,
  activeEntry: TimeEntry | null,
  state: ReminderState,
  now = new Date(),
): ReminderDecision[] {
  const decisions: ReminderDecision[] = [];
  const date = today.date;

  if (
    settings.reminderLongSessionEnabled &&
    state.longSessionDate !== date &&
    isLongActiveSession(activeEntry, settings.reminderLongSessionMinutes, now)
  ) {
    decisions.push({ key: "longSessionDate", title: "TimeGlass", body: "Du bist noch eingestempelt." });
  }

  if (settings.reminderClockOutEnabled && state.clockOutDate !== date && activeEntry && isAfterClock(settings.reminderClockOutTime, now)) {
    decisions.push({ key: "clockOutDate", title: "TimeGlass", body: "Erinnerung zum Ausstempeln." });
  }

  if (settings.reminderNoTimeTodayEnabled && state.noTimeDate !== date && today.grossMinutes === 0 && isAfterClock("10:00", now)) {
    decisions.push({ key: "noTimeDate", title: "TimeGlass", body: "Heute ist noch keine Arbeitszeit erfasst." });
  }

  if (
    settings.reminderTargetReachedEnabled &&
    state.targetReachedDate !== date &&
    today.targetMinutes != null &&
    today.targetMinutes > 0 &&
    today.netMinutes >= today.targetMinutes
  ) {
    decisions.push({ key: "targetReachedDate", title: "TimeGlass", body: "Deine heutige Sollzeit ist erreicht." });
  }

  if (
    settings.notifyUnusualSession &&
    !decisions.some((decision) => decision.key === "longSessionDate") &&
    state.longSessionDate !== date &&
    isLongActiveSession(activeEntry, settings.unusualSessionMinutes, now)
  ) {
    decisions.push({ key: "longSessionDate", title: "TimeGlass", body: "Die aktive Session läuft ungewöhnlich lang." });
  }

  return decisions;
}
