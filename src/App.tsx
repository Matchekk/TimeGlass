import { CalendarDays, CalendarRange, Clock3, Home, Plane, Settings as SettingsIcon, Timer, WalletCards } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isPermissionGranted, sendNotification } from "@tauri-apps/plugin-notification";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DashboardPage } from "./pages/DashboardPage";
import { TodayPage } from "./pages/TodayPage";
import { WeekPage } from "./pages/WeekPage";
import { MonthPage } from "./pages/MonthPage";
import { YearPage } from "./pages/YearPage";
import { SettingsPage } from "./pages/SettingsPage";
import { LeavePage } from "./pages/LeavePage";
import type { DayOverride, DaySummary, LeaveEntry, Settings, TimeEntry } from "./types";
import { getAllEntries, getAllOverrides, getEntriesForDateKeys, getOverrides, startEntry, stopActiveEntry } from "./db/timeEntries";
import { getLeaveEntries } from "./db/leaveEntries";
import { getSettings } from "./db/settings";
import { getMonthDates, getWeekDates, getYearDates, toDateKey } from "./lib/dateUtils";
import { calculateFlexBalance, summarizeDay, summarizePeriod } from "./lib/timeCalculations";
import { formatMinutes } from "./lib/formatting";
import { getRefreshIntervalMs } from "./lib/performanceMode";
import { getReminderDecisions, resetReminderStateForNewSession, type ReminderState } from "./lib/reminders";
import { eachDateInRange, findLeaveForDate, leaveTypeLabel } from "./lib/leaveCalculations";
import type { DayType } from "./types";

export type Page = "dashboard" | "today" | "week" | "month" | "year" | "leave" | "settings";

export interface AppData {
  settings: Settings;
  today: DaySummary;
  week: DaySummary[];
  month: DaySummary[];
  year: DaySummary[];
  allDays: DaySummary[];
  entries: TimeEntry[];
  overrides: DayOverride[];
  leaveEntries: LeaveEntry[];
  flexBalanceMinutes: number;
}

const nav = [
  { page: "dashboard", label: "Dashboard", icon: Home },
  { page: "today", label: "Heute", icon: Timer },
  { page: "week", label: "Woche", icon: CalendarRange },
  { page: "month", label: "Monat", icon: CalendarDays },
  { page: "year", label: "Jahr", icon: WalletCards },
  { page: "leave", label: "Urlaub", icon: Plane },
  { page: "settings", label: "Einstellungen", icon: SettingsIcon },
] as const;

function overridesMap(overrides: DayOverride[]): Map<string, DayOverride> {
  return new Map(overrides.map((override) => [override.date, override]));
}

function leaveTypeToDayType(type: string): DayType {
  if (type === "vacation") return "vacation";
  if (type === "sick") return "sick";
  if (type === "public_holiday" || type === "time_off") return "free";
  return "other";
}

function applyLeaveToSummary(summary: DaySummary, leave: LeaveEntry | undefined, settings: Settings, hasOverride: boolean): DaySummary {
  if (!leave || hasOverride) return summary;
  if (settings.defaultPaidAbsenceBehavior === "counts_as_target" && summary.netMinutes === 0 && summary.targetMinutes > 0) {
    return {
      ...summary,
      netMinutes: summary.targetMinutes,
      differenceMinutes: 0,
      dayType: leaveTypeToDayType(leave.type),
      note: leave.note ?? leaveTypeLabel(leave.type),
    };
  }
  return {
    ...summary,
    targetMinutes: 0,
    differenceMinutes: summary.netMinutes,
    dayType: leaveTypeToDayType(leave.type),
    note: leave.note ?? leaveTypeLabel(leave.type),
  };
}

function activeSessionMinutes(activeEntry: TimeEntry | null, now: Date): number {
  if (!activeEntry || activeEntry.end_time) return 0;
  return Math.max(0, Math.round((now.getTime() - new Date(activeEntry.start_time).getTime()) / 60_000));
}

export function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [selectedMonth, setSelectedMonth] = useState(() => new Date());
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(() => new Date());
  const [isVisible, setIsVisible] = useState(() => document.visibilityState === "visible");
  const minimizedOnce = useRef(false);

  useEffect(() => {
    const active = data?.entries.some((entry) => !entry.end_time) ?? false;
    const interval = getRefreshIntervalMs(data?.settings.lowRamMode ?? true, isVisible, active);
    const timer = window.setInterval(() => setTick(new Date()), interval);
    return () => window.clearInterval(timer);
  }, [data?.settings.lowRamMode, data?.entries, isVisible]);

  useEffect(() => {
    const onVisibility = () => setIsVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const now = new Date();
      const todayKey = toDateKey(now);
      const weekKeys = getWeekDates(now);
      const monthKeys = getMonthDates(now);
      const yearKeys = getYearDates(now.getFullYear());
      const allKeys = Array.from(new Set([...weekKeys, ...monthKeys, ...yearKeys, todayKey]));
      const [settings, entries, overrides, allEntries, allOverrides, leaveEntries] = await Promise.all([
        getSettings(),
        getEntriesForDateKeys(allKeys),
        getOverrides(allKeys),
        getAllEntries(),
        getAllOverrides(),
        getLeaveEntries(),
      ]);
      const map = overridesMap(overrides);
      const allMap = overridesMap(allOverrides);
      const make = (key: string) => {
        const summary = summarizeDay(key, entries, map.get(key), settings, now);
        const leave = findLeaveForDate(leaveEntries, key);
        return applyLeaveToSummary(summary, leave, settings, map.has(key));
      };
      const year = yearKeys.map(make);
      const allRecordedKeys = Array.from(
        new Set([
          ...allEntries.map((entry) => toDateKey(new Date(entry.start_time))),
          ...allOverrides.map((override) => override.date),
          ...leaveEntries.flatMap((entry) => eachDateInRange(entry.start_date, entry.end_date)),
        ]),
      ).sort();
      const allDays = allRecordedKeys.map((key) => {
        const summary = summarizeDay(key, allEntries, allMap.get(key), settings, now);
        const leave = findLeaveForDate(leaveEntries, key);
        return applyLeaveToSummary(summary, leave, settings, allMap.has(key));
      });
      setData({
        settings,
        today: make(todayKey),
        week: weekKeys.map(make),
        month: monthKeys.map(make),
        year,
        allDays,
        entries,
        overrides,
        leaveEntries,
        flexBalanceMinutes: calculateFlexBalance(allDays, settings.startBalanceMinutes),
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Die Daten konnten nicht geladen werden.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, page]);

  const liveData = useMemo(() => {
    if (!data) return null;
    const todayOverride = data.overrides.find((override) => override.date === data.today.date);
    const summary = summarizeDay(data.today.date, data.entries, todayOverride, data.settings, tick);
    const today = applyLeaveToSummary(summary, findLeaveForDate(data.leaveEntries, data.today.date), data.settings, Boolean(todayOverride));
    return { ...data, today };
  }, [data, tick]);

  useEffect(() => {
    if (!liveData) return;
    void invoke("set_close_to_tray", { enabled: liveData.settings.closeToTray });
    const activeEntry = liveData.entries.find((entry) => !entry.end_time) ?? null;
    void invoke("update_tray_status", {
      status: activeEntry ? "Status: Eingestempelt" : "Status: Ausgestempelt",
      session: activeEntry ? `Aktuelle Session: ${formatMinutes(activeSessionMinutes(activeEntry, tick))}` : "Aktuelle Session: -",
      toggleLabel: activeEntry ? "Ausstempeln" : "Einstempeln",
    }).catch(() => undefined);
  }, [liveData, tick]);

  useEffect(() => {
    if (!liveData) return;
    const activeEntry = liveData.entries.find((entry) => !entry.end_time) ?? null;
    const state = JSON.parse(localStorage.getItem("timeglass.reminderState") ?? "{}") as ReminderState;
    const decisions = getReminderDecisions(liveData.settings, liveData.today, activeEntry, state, tick);
    if (decisions.length === 0) return;
    void isPermissionGranted().then((granted) => {
      if (!granted) return;
      const nextState = { ...state };
      for (const decision of decisions) {
        sendNotification({ title: decision.title, body: decision.body });
        nextState[decision.key] = liveData.today.date;
      }
      localStorage.setItem("timeglass.reminderState", JSON.stringify(nextState));
    });
  }, [liveData, tick]);

  useEffect(() => {
    if (!liveData || minimizedOnce.current || !liveData.settings.startMinimized) return;
    minimizedOnce.current = true;
    void invoke<boolean>("is_autostart_launch").then((autostart) => {
      if (autostart) void getCurrentWindow().minimize();
    });
  }, [liveData]);

  useEffect(() => {
    const unlisteners: Array<() => void> = [];
    void listen("tray://toggle-punch", async () => {
      try {
        const active = data?.entries.find((entry) => !entry.end_time);
        if (active) await stopActiveEntry();
        else {
          await startEntry();
          resetReminderStateForNewSession(toDateKey());
        }
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Tray-Aktion fehlgeschlagen.");
      }
    }).then((unlisten) => unlisteners.push(unlisten));
    void listen("tray://today", () => setPage("today")).then((unlisten) => unlisteners.push(unlisten));
    return () => unlisteners.forEach((unlisten) => unlisten());
  }, [data?.entries, refresh]);

  const content = useMemo(() => {
    if (!liveData) return <div className="glass-panel state-panel">TimeGlass wird geladen...</div>;
    const common = { data: liveData, refresh };
    if (page === "today") return <TodayPage {...common} />;
    if (page === "week") return <WeekPage {...common} />;
    if (page === "month") return <MonthPage {...common} monthDate={selectedMonth} onMonthChange={setSelectedMonth} />;
    if (page === "year") {
      return (
        <YearPage
          {...common}
          onMonthSelect={(monthDate) => {
            setSelectedMonth(monthDate);
            setPage("month");
          }}
        />
      );
    }
    if (page === "leave") return <LeavePage {...common} />;
    if (page === "settings") return <SettingsPage {...common} />;
    return <DashboardPage {...common} navigate={setPage} />;
  }, [liveData, page, refresh, selectedMonth]);

  const weekTotal = data ? summarizePeriod(data.week) : null;
  const todayRemaining = liveData ? Math.max(0, liveData.today.targetMinutes - liveData.today.netMinutes) : null;

  return (
    <div className="app-shell">
      <aside className="sidebar glass-panel">
        <div className="brand">
          <Clock3 size={30} aria-hidden="true" />
          <div>
            <strong>TimeGlass</strong>
            <span>Private Gleitzeit</span>
          </div>
        </div>
        <nav aria-label="Hauptnavigation">
          {nav.map(({ page: navPage, label, icon: Icon }) => (
            <button
              type="button"
              className={page === navPage ? "nav-item active" : "nav-item"}
              key={navPage}
              aria-current={page === navPage ? "page" : undefined}
              aria-label={label}
              onClick={() => {
                if (navPage === "month") setSelectedMonth(new Date());
                setPage(navPage);
              }}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        {todayRemaining != null && (
          <div className="sidebar-meta compact">
            <span>Heute noch offen</span>
            <strong>{formatMinutes(todayRemaining)}</strong>
          </div>
        )}
        {weekTotal && (
          <div className="sidebar-meta">
            <span>Wochenbilanz</span>
            <strong>{weekTotal.differenceMinutes >= 0 ? "+" : ""}{Math.round(weekTotal.differenceMinutes / 60 * 10) / 10} h</strong>
          </div>
        )}
      </aside>
      <main className="main-content">
        {error && <div className="error-banner">{error}</div>}
        {content}
      </main>
    </div>
  );
}
