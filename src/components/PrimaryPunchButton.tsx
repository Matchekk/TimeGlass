import { LogIn, LogOut } from "lucide-react";
import { startEntry, stopActiveEntry } from "../db/timeEntries";
import type { TimeEntry } from "../types";

interface Props {
  activeEntry: TimeEntry | null;
  onDone: () => Promise<void>;
  onError: (message: string) => void;
}

export function PrimaryPunchButton({ activeEntry, onDone, onError }: Props) {
  async function toggle() {
    try {
      if (activeEntry) {
        await stopActiveEntry();
      } else {
        await startEntry();
      }
      await onDone();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Aktion fehlgeschlagen.");
    }
  }

  return (
    <button className={`punch-button ${activeEntry ? "running" : ""}`} onClick={() => void toggle()}>
      {activeEntry ? <LogOut size={26} /> : <LogIn size={26} />}
      <span>{activeEntry ? "Ausstempeln" : "Einstempeln"}</span>
    </button>
  );
}
