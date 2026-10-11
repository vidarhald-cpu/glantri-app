import os from "node:os";

import { afterEach, describe, expect, it, vi } from "vitest";

import { CONCURRENT_SUITE_BUDGET, resolveTestWorkers } from "./vitest.base";

// Forgejo #553. Vitest's `forks` pool defaults to `availableParallelism() - 1` workers per
// suite, and `turbo test` runs several suites at once, so the default aggregate far exceeds
// the real CPU and memory budget — which no process inside a CI job container can observe.
// These examples protect the bound, because losing it does not fail any test directly: it
// re-arms an intermittent `Test timed out in 5000ms` in whichever unrelated test is running
// when the stall lands.
describe("test worker budget", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("gives each concurrently scheduled suite a share of the reported parallelism", () => {
    vi.stubEnv("GLANTRI_TEST_WORKERS", "");
    vi.spyOn(os, "availableParallelism").mockReturnValue(16);

    expect(resolveTestWorkers()).toBe(16 / CONCURRENT_SUITE_BUDGET);
  });

  it("never resolves to fewer than one worker on a single-CPU runner", () => {
    vi.stubEnv("GLANTRI_TEST_WORKERS", "");
    vi.spyOn(os, "availableParallelism").mockReturnValue(1);

    expect(resolveTestWorkers()).toBe(1);
  });

  it("stays below the per-suite default so concurrent suites cannot oversubscribe the host", () => {
    vi.stubEnv("GLANTRI_TEST_WORKERS", "");
    const reported = 18;
    vi.spyOn(os, "availableParallelism").mockReturnValue(reported);

    const vitestDefault = reported - 1;

    expect(resolveTestWorkers() * CONCURRENT_SUITE_BUDGET).toBeLessThanOrEqual(reported);
    expect(resolveTestWorkers()).toBeLessThan(vitestDefault);
  });

  it("lets an operator widen or narrow the budget without a workflow change", () => {
    vi.stubEnv("GLANTRI_TEST_WORKERS", "12");
    vi.spyOn(os, "availableParallelism").mockReturnValue(18);

    expect(resolveTestWorkers()).toBe(12);
  });

  it("ignores an override that is not a positive integer", () => {
    vi.spyOn(os, "availableParallelism").mockReturnValue(18);

    for (const override of ["0", "-4", "not-a-number", ""]) {
      vi.stubEnv("GLANTRI_TEST_WORKERS", override);

      expect(resolveTestWorkers()).toBe(Math.floor(18 / CONCURRENT_SUITE_BUDGET));
    }
  });
});
