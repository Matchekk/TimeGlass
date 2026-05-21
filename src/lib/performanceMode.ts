export class CentralTimer {
  private timerId: ReturnType<typeof setInterval> | null = null;

  start(callback: () => void, intervalMs: number): void {
    this.stop();
    this.timerId = setInterval(callback, intervalMs);
  }

  stop(): void {
    if (this.timerId != null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  isRunning(): boolean {
    return this.timerId != null;
  }
}

export function getRefreshIntervalMs(lowRamMode: boolean, visible: boolean, hasActiveSession: boolean): number {
  if (!hasActiveSession) return lowRamMode ? 60_000 : 30_000;
  if (visible) return lowRamMode ? 1_000 : 1_000;
  return lowRamMode ? 60_000 : 30_000;
}
