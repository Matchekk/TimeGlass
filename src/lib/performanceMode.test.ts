import { describe, expect, it, vi } from "vitest";
import { CentralTimer, getRefreshIntervalMs } from "./performanceMode";

describe("performance mode", () => {
  it("uses coarse refresh when hidden in low ram mode", () => {
    expect(getRefreshIntervalMs(true, false, true)).toBe(60_000);
  });

  it("does not keep multiple central timers", () => {
    vi.useFakeTimers();
    const timer = new CentralTimer();
    timer.start(() => undefined, 1000);
    timer.start(() => undefined, 1000);
    expect(vi.getTimerCount()).toBe(1);
    timer.stop();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});
