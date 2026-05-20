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
import { getReminderDecisions, type ReminderState } from "./lib/reminders";
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
        if (!leave || map.has(key)) return summary;
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
        if (!leave || allMap.has(key)) return summary;
        if (settings.defaultPaidAbsenceBehavior === "counts_as_target" && summary.netMinutes === 0 && summary.targetMinutes > 0) {
          return { ...summary, netMinutes: summary.targetMinutes, differenceMinutes: 0, dayType: leaveTypeToDayType(leave.type) };
        }
        return { ...summary, targetMinutes: 0, differenceMinutes: summary.netMinutes, dayType: leaveTypeToDayType(leave.type) };
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
  }, [refresh, tick]);

  useEffect(() => {
    if (!data) return;
    void invoke("set_close_to_tray", { enabled: data.settings.closeToTray });
    const activeEntry = data.entries.find((entry) => !entry.end_time) ?? null;
    void invoke("update_tray_status", {
      status: activeEntry ? "Status: Eingestempelt" : "Status: Ausgestempelt",
      session: activeEntry ? `Aktuelle Session: ${formatMinutes(data.today.grossMinutes)}` : "Aktuelle Session: -",
      toggleLabel: activeEntry ? "Ausstempeln" : "Einstempeln",
    }).catch(() => undefined);
  }, [data]);

  useEffect(() => {
    if (!data) return;
    const activeEntry = data.entries.find((entry) => !entry.end_time) ?? null;
    const state = JSON.parse(localStorage.getItem("timeglass.reminderState") ?? "{}") as ReminderState;
    const decisions = getReminderDecisions(data.settings, data.today, activeEntry, state, tick);
    if (decisions.length === 0) return;
    void isPermissionGranted().then((granted) => {
      if (!granted) return;
      const nextState = { ...state };
      for (const decision of decisions) {
        sendNotification({ title: decision.title, body: decision.body });
        nextState[decision.key] = data.today.date;
      }
      localStorage.setItem("timeglass.reminderState", JSON.stringify(nextState));
    });
  }, [data, tick]);

  useEffect(() => {
    if (!data || minimizedOnce.current || !data.settings.startMinimized) return;
    minimizedOnce.current = true;
    void invoke<boolean>("is_autostart_launch").then((autostart) => {
      if (autostart) void getCurrentWindow().minimize();
    });
  }, [data]);

  useEffect(() => {
    const unlisteners: Array<() => void> = [];
    void listen("tray://toggle-punch", async () => {
      try {
        const active = data?.entries.find((entry) => !entry.end_time);
        if (active) await stopActiveEntry();
        else await startEntry();
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Tray-Aktion fehlgeschlagen.");
      }
    }).then((unlisten) => unlisteners.push(unlisten));
    void listen("tray://today", () => setPage("today")).then((unlisten) => unlisteners.push(unlisten));
    return () => unlisteners.forEach((unlisten) => unlisten());
  }, [data?.entries, refresh]);

  const content = useMemo(() => {
    if (!data) return <div className="glass-panel state-panel">TimeGlass wird geladen...</div>;
    const common = { data, refresh };
    if (page === "today") return <TodayPage {...common} />;
    if (page === "week") return <WeekPage {...common} />;
    if (page === "month") return <MonthPage {...common} monthDate={selectedMonth} />;
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
  }, [data, page, refresh, selectedMonth]);

  const weekTotal = data ? summarizePeriod(data.week) : null;
  const todayRemaining = data ? Math.max(0, data.today.targetMinutes - data.today.netMinutes) : null;

  return (
    <div className="app-shell">
      <aside className="sidebar glass-panel">
        <div className="brand">
          <Clock3 size={30} />
          <div>
            <strong>TimeGlass</strong>
            <span>Private Gleitzeit</span>
          </div>
        </div>
        <nav>
          {nav.map(({ page: navPage, label, icon: Icon }) => (
            <button
              className={page === navPage ? "nav-item active" : "nav-item"}
              key={navPage}
              onClick={() => {
                if (navPage === "month") setSelectedMonth(new Date());
                setPage(navPage);
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        {todayRemaining != null && (
          <div className="sidebar-meta compact">
            <span>Heute fehlt</span>
            <strong>{formatMinutes(todayRemaining)}</strong>
          </div>
        )}
        {weekTotal && (
          <div className="sidebar-meta">
            <span>Woche</span>
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
