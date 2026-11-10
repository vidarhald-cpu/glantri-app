import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startGuardedPolling } from "./guardedPolling";

function setVisibility(state: "hidden" | "visible") {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
}

describe("startGuardedPolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility("visible");
  });
  afterEach(() => {
    vi.useRealTimers();
    setVisibility("visible");
  });

  it("sends no request while the tab is hidden", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const polling = startGuardedPolling({ intervalMs: 1000, refresh });
    setVisibility("hidden");
    await vi.advanceTimersByTimeAsync(5000);
    expect(refresh).not.toHaveBeenCalled();
    polling.stop();
  });

  it("refreshes on the interval while visible", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const polling = startGuardedPolling({ intervalMs: 1000, refresh });
    await vi.advanceTimersByTimeAsync(3000);
    expect(refresh).toHaveBeenCalledTimes(3);
    polling.stop();
    await vi.advanceTimersByTimeAsync(3000);
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("never starts a second request while one is pending", async () => {
    let release: () => void = () => undefined;
    const refresh = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const polling = startGuardedPolling({ intervalMs: 1000, refresh });
    await vi.advanceTimersByTimeAsync(5000);
    expect(refresh).toHaveBeenCalledTimes(1);
    release();
    await vi.advanceTimersByTimeAsync(1000);
    expect(refresh).toHaveBeenCalledTimes(2);
    polling.stop();
  });

  it("refreshes once when the tab becomes visible again", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const polling = startGuardedPolling({ intervalMs: 60_000, refresh });
    setVisibility("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(refresh).not.toHaveBeenCalled();
    setVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(1);
    polling.stop();
  });

  it("recovers after a failed refresh", async () => {
    const refresh = vi.fn().mockRejectedValueOnce(new Error("x")).mockResolvedValue(undefined);
    const polling = startGuardedPolling({ intervalMs: 1000, refresh });
    await vi.advanceTimersByTimeAsync(2000);
    expect(refresh).toHaveBeenCalledTimes(2);
    polling.stop();
  });
});
