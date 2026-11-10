import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loadScenarioSession = vi.fn();

vi.mock("@/lib/api/localServiceClient", () => ({
  loadScenarioSession: (...args: unknown[]) => loadScenarioSession(...args),
  pickUpScenarioAvailableItemOnServer: vi.fn(),
}));
vi.mock("@/lib/auth/SessionUserContext", () => {
  const value = { currentUser: { id: "u1" }, loading: false };
  return { useSessionUser: () => value };
});
vi.mock("@/features/scenarios/situation/ScenarioSituationView", () => ({
  ScenarioSituationView: () => null,
}));

import ScenarioPlayerPageContent from "./ScenarioPlayerPageContent";

function setVisibility(state: "hidden" | "visible") {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
}

const session = { revision: 1, scenario: { id: "s1", status: "active" } };

describe("ScenarioPlayerPageContent polling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility("visible");
    loadScenarioSession.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
    setVisibility("visible");
  });

  it("does not poll while hidden, does not overlap, and refreshes when visible again", async () => {
    loadScenarioSession.mockResolvedValue(session);
    const view = render(<ScenarioPlayerPageContent scenarioId="s1" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(loadScenarioSession).toHaveBeenCalledTimes(1);

    setVisibility("hidden");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(loadScenarioSession).toHaveBeenCalledTimes(1);

    setVisibility("visible");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(loadScenarioSession).toHaveBeenCalledTimes(2);

    let release: (value: unknown) => void = () => undefined;
    loadScenarioSession.mockImplementation(() => new Promise((resolve) => (release = resolve)));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000);
    });
    expect(loadScenarioSession).toHaveBeenCalledTimes(3);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(loadScenarioSession).toHaveBeenCalledTimes(3);
    await act(async () => {
      release(session);
      await vi.advanceTimersByTimeAsync(4_000);
    });
    expect(loadScenarioSession).toHaveBeenCalledTimes(4);
    view.unmount();
  });

  it("starts no second request while the mount request is still pending", async () => {
    let release: (value: unknown) => void = () => undefined;
    loadScenarioSession.mockImplementation(() => new Promise((resolve) => (release = resolve)));
    const view = render(<ScenarioPlayerPageContent scenarioId="s1" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(loadScenarioSession).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(loadScenarioSession).toHaveBeenCalledTimes(1);
    loadScenarioSession.mockResolvedValue(session);
    await act(async () => {
      release(session);
      await vi.advanceTimersByTimeAsync(4_000);
    });
    expect(loadScenarioSession).toHaveBeenCalledTimes(2);
    view.unmount();
  });
});
