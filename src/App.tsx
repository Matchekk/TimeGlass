import { CalendarDays, CalendarRange, Clock3, Home, Settings as SettingsIcon, Timer, WalletCards } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardPage } from "./pages/DashboardPage";
import { TodayPage } from "./pages/TodayPage";
import { WeekPage } from "./pages/WeekPage";
import { MonthPage } from "./pages/MonthPage";
import { YearPage } from "./pages/YearPage";
import { SettingsPage } from "./pages/SettingsPage";
import type { DayOverride, DaySummary, Settings, TimeEntry } from "./types";
import { getAllEntries, getAllOverrides, getEntriesForDateKeys, getOverrides } from "./db/timeEntries";
import { getSettings } from "./db/settings";
import { getMonthDates, getWeekDates, getYearDates, toDateKey } from "./lib/dateUtils";
import { calculateFlexBalance, summarizeDay, summarizePeriod } from "./lib/timeCalculations";

export type Page = "dashboard" | "today" | "week" | "month" | "year" | "settings";

export interface AppData {
  settings: Settings;
  today: DaySummary;
  week: DaySummary[];
  month: DaySummary[];
  year: DaySummary[];
  allDays: DaySummary[];
  entries: TimeEntry[];
  overrides: DayOverride[];
  flexBalanceMinutes: number;
}

const nav = [
  { page: "dashboard", label: "Dashboard", icon: Home },
  { page: "today", label: "Heute", icon: Timer },
  { page: "week", label: "Woche", icon: CalendarRange },
  { page: "month", label: "Monat", icon: CalendarDays },
  { page: "year", label: "Jahr", icon: WalletCards },
  { page: "settings", label: "Einstellungen", icon: SettingsIcon },
] as const;

function overridesMap(overrides: DayOverride[]): Map<string, DayOverride> {
  return new Map(overrides.map((override) => [override.date, override]));
}

export function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setTick(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const now = new Date();
      const todayKey = toDateKey(now);
      const weekKeys = getWeekDates(now);
      const monthKeys = getMonthDates(now);
      const yearKeys = getYearDates(now.getFullYear());
      const allKeys = Array.from(new Set([...weekKeys, ...monthKeys, ...yearKeys, todayKey]));
      const [settings, entries, overrides, allEntries, allOverrides] = await Promise.all([
        getSettings(),
        getEntriesForDateKeys(allKeys),
        getOverrides(allKeys),
        getAllEntries(),
        getAllOverrides(),
      ]);
      const map = overridesMap(overrides);
      const allMap = overridesMap(allOverrides);
      const make = (key: string) => summarizeDay(key, entries, map.get(key), settings, now);
      const year = yearKeys.map(make);
      const allRecordedKeys = Array.from(
        new Set([...allEntries.map((entry) => toDateKey(new Date(entry.start_time))), ...allOverrides.map((override) => override.date)]),
      ).sort();
      const allDays = allRecordedKeys.map((key) => summarizeDay(key, allEntries, allMap.get(key), settings, now));
      setData({
        settings,
        today: make(todayKey),
        week: weekKeys.map(make),
        month: monthKeys.map(make),
        year,
        allDays,
        entries,
        overrides,
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

  const content = useMemo(() => {
    if (!data) return <div className="glass-panel state-panel">TimeGlass wird geladen...</div>;
    const common = { data, refresh };
    if (page === "today") return <TodayPage {...common} />;
    if (page === "week") return <WeekPage {...common} />;
    if (page === "month") return <MonthPage {...common} />;
    if (page === "year") return <YearPage {...common} />;
    if (page === "settings") return <SettingsPage {...common} />;
    return <DashboardPage {...common} />;
  }, [data, page, refresh]);

  const weekTotal = data ? summarizePeriod(data.week) : null;

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
            <button className={page === navPage ? "nav-item active" : "nav-item"} key={navPage} onClick={() => setPage(navPage)}>
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
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
