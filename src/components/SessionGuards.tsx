import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import { dateTimeLocalValue, fromDateKey, localInputToIso, toDateKey } from "../lib/dateUtils";
import { formatClock, formatMinutes } from "../lib/formatting";
import { updateEntry } from "../db/timeEntries";
import type { Settings, TimeEntry } from "../types";

interface SessionGuardsProps {
  activeEntry: TimeEntry | null;
  settings: Settings;
  now: Date;
  refresh: () => Promise<void>;
  onError: (message: string) => void;
}

const FORGOT_THRESHOLD_MINUTES = 16 * 60;

function suggestedClockOutIso(activeEntry: TimeEntry, settings: Settings): string {
  const startDateKey = toDateKey(new Date(activeEntry.start_time));
  const [hours, minutes] = (settings.reminderClockOutTime || "17:00").split(":").map(Number);
  const suggestion = fromDateKey(startDateKey);
  suggestion.setHours(Number.isFinite(hours) ? hours : 17, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  const start = new Date(activeEntry.start_time);
  if (suggestion.getTime() <= start.getTime()) {
    return new Date(start.getTime() + Math.max(0, settings.standardTargetMinutes) * 60_000).toISOString();
  }
  return suggestion.toISOString();
}

export function SessionGuards({ activeEntry, settings, now, refresh, onError }: SessionGuardsProps) {
  // --- Vergessen auszustempeln -------------------------------------------------
  const [forgotDismissedId, setForgotDismissedId] = useState<number | null>(null);
  const [correctTime, setCorrectTime] = useState<string>("");
  const lastForgotId = useRef<number | null>(null);

  const sessionMinutes = activeEntry
    ? Math.max(0, Math.round((now.getTime() - new Date(activeEntry.start_time).getTime()) / 60_000))
    : 0;
  const crossesDay = activeEntry ? toDateKey(new Date(activeEntry.start_time)) < toDateKey(now) : false;
  const forgotActive = Boolean(activeEntry) && (crossesDay || sessionMinutes >= FORGOT_THRESHOLD_MINUTES);

  useEffect(() => {
    if (activeEntry && lastForgotId.current !== activeEntry.id) {
      lastForgotId.current = activeEntry.id;
      setCorrectTime(dateTimeLocalValue(suggestedClockOutIso(activeEntry, settings)));
    }
    if (!activeEntry) {
      lastForgotId.current = null;
      setForgotDismissedId(null);
    }
  }, [activeEntry, settings]);

  async function applyForgotCorrection() {
    if (!activeEntry) return;
    try {
      const endIso = localInputToIso(correctTime);
      if (new Date(endIso).getTime() <= new Date(activeEntry.start_time).getTime()) {
        onError("Die Ausstempel-Zeit muss nach dem Einstempeln liegen.");
        return;
      }
      await updateEntry(activeEntry.id, activeEntry.start_time, endIso, activeEntry.note);
      await refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Korrektur fehlgeschlagen.");
    }
  }

  // --- Abwesenheit / Idle ------------------------------------------------------
  const [idleMinutes, setIdleMinutes] = useState<number | null>(null);
  const [idleSinceIso, setIdleSinceIso] = useState<string | null>(null);
  const idleDismissed = useRef(false);

  useEffect(() => {
    if (!activeEntry || !settings.idleDetectionEnabled) {
      setIdleMinutes(null);
      setIdleSinceIso(null);
      idleDismissed.current = false;
      return;
    }
    let cancelled = false;
    void invoke<number>("get_idle_seconds")
      .then((seconds) => {
        if (cancelled) return;
        const thresholdSeconds = Math.max(1, settings.idleThresholdMinutes) * 60;
        if (seconds >= thresholdSeconds) {
          if (!idleDismissed.current) {
            setIdleMinutes(Math.round(seconds / 60));
            setIdleSinceIso(new Date(now.getTime() - seconds * 1000).toISOString());
          }
        } else {
          idleDismissed.current = false;
          setIdleMinutes(null);
          setIdleSinceIso(null);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [activeEntry, settings.idleDetectionEnabled, settings.idleThresholdMinutes, now]);

  async function trimIdleTime() {
    if (!activeEntry || !idleSinceIso) return;
    try {
      if (new Date(idleSinceIso).getTime() <= new Date(activeEntry.start_time).getTime()) {
        onError("Die Abwesenheit liegt vor dem Einstempeln – bitte manuell korrigieren.");
        return;
      }
      await updateEntry(activeEntry.id, activeEntry.start_time, idleSinceIso, activeEntry.note);
      idleDismissed.current = true;
      setIdleMinutes(null);
      setIdleSinceIso(null);
      await refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Abwesenheit konnte nicht abgezogen werden.");
    }
  }

  function dismissIdle() {
    idleDismissed.current = true;
    setIdleMinutes(null);
    setIdleSinceIso(null);
  }

  const showForgot = forgotActive && activeEntry != null && forgotDismissedId !== activeEntry.id;
  const showIdle = idleMinutes != null && idleSinceIso != null && activeEntry != null;

  if (!showForgot && !showIdle) return null;

  return (
    <div className="guard-stack">
      {showIdle && (
        <div className="guard-banner" role="alertdialog" aria-label="Abwesenheit erkannt">
          <div>
            <strong>Abwesend seit {formatClock(idleSinceIso)}?</strong>
            <span>
              Keine Eingaben seit {formatMinutes(idleMinutes!)} Stunden. Soll die Abwesenheit von der laufenden Session
              abgezogen werden (Ausstempeln auf {formatClock(idleSinceIso)})?
            </span>
          </div>
          <div className="guard-actions">
            <button type="button" className="secondary-button" onClick={() => void trimIdleTime()}>
              Abwesenheit abziehen
            </button>
            <button type="button" className="secondary-button danger-soft" onClick={dismissIdle}>
              Weiterlaufen lassen
            </button>
          </div>
        </div>
      )}
      {showForgot && (
        <div className="guard-banner" role="alertdialog" aria-label="Vergessen auszustempeln">
          <div>
            <strong>Noch eingestempelt seit {formatClock(activeEntry!.start_time)}</strong>
            <span>
              Die Session läuft seit {formatMinutes(sessionMinutes)} Stunden{crossesDay ? " (über Nacht)" : ""}. Hast du
              vielleicht vergessen auszustempeln?
            </span>
          </div>
          <div className="guard-actions">
            <label className="guard-time">
              Ausstempeln auf
              <input
                type="datetime-local"
                value={correctTime}
                onChange={(event) => setCorrectTime(event.target.value)}
              />
            </label>
            <button type="button" className="secondary-button" onClick={() => void applyForgotCorrection()}>
              Korrigiert ausstempeln
            </button>
            <button
              type="button"
              className="secondary-button danger-soft"
              onClick={() => setForgotDismissedId(activeEntry!.id)}
            >
              Läuft noch
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
