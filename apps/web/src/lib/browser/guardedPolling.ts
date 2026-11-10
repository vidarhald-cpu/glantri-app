export type GuardedPolling = {
  /** Runs refresh now, ignoring tab visibility but never overlapping a pending refresh. */
  refreshNow: () => void;
  stop: () => void;
};

/**
 * Timed refresh that is skipped while the tab is hidden or a refresh is pending,
 * and runs once when the tab becomes visible or focused again.
 */
export function startGuardedPolling(input: {
  intervalMs: number;
  refresh: () => Promise<unknown>;
  /** Optional mount-time refresh, sent through the same in-flight guard regardless of visibility. */
  initialRefresh?: () => Promise<unknown>;
}): GuardedPolling {
  let inFlight = false;
  let stopped = false;

  function run(ignoreHidden: boolean, refresh: () => Promise<unknown> = input.refresh) {
    if (stopped || inFlight) return;
    if (!ignoreHidden && document.visibilityState === "hidden") return;
    inFlight = true;
    void Promise.resolve()
      .then(refresh)
      .catch(() => undefined)
      .finally(() => {
        inFlight = false;
      });
  }

  const refreshVisible = () => run(false);
  const intervalId = window.setInterval(refreshVisible, input.intervalMs);
  window.addEventListener("focus", refreshVisible);
  document.addEventListener("visibilitychange", refreshVisible);

  if (input.initialRefresh) run(true, input.initialRefresh);

  return {
    refreshNow: () => run(true),
    stop: () => {
      stopped = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
    },
  };
}
