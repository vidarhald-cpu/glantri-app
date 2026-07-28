import { describe, expect, it, vi } from "vitest";

import { createActiveInspectorPresentationStore } from "./activeInspectorPresentation";

describe("active inspector presentation ownership", () => {
  it("reuses participant inspector candidates across selection changes", () => {
    const store = createActiveInspectorPresentationStore();
    const buildFirst = vi.fn(() => ({ participantId: "participant-1" }));
    const buildSecond = vi.fn(() => ({ participantId: "participant-2" }));

    const first = store.resolve({
      build: buildFirst,
      dependencies: ["revision-1", "participant-1"],
      key: "inspector:participant-1",
    });
    const second = store.resolve({
      build: buildSecond,
      dependencies: ["revision-1", "participant-2"],
      key: "inspector:participant-2",
    });
    const reselected = store.resolve({
      build: () => ({ participantId: "unexpected" }),
      dependencies: ["revision-1", "participant-1"],
      key: "inspector:participant-1",
    });

    expect(reselected).toBe(first);
    expect(second).not.toBe(first);
    expect(buildFirst).toHaveBeenCalledTimes(1);
    expect(buildSecond).toHaveBeenCalledTimes(1);
  });

  it.each(["active-modifiers", "active-results", "equipment-loadout", "phase-summaries"])(
    "keeps the %s submodel stable across transient overlay changes",
    (key) => {
      const store = createActiveInspectorPresentationStore();
      const canonicalDependencies = ["revision-1", { participantId: "participant-1" }] as const;
      const build = vi.fn(() => ({ key }));
      const first = store.resolve({
        build,
        dependencies: canonicalDependencies,
        key,
      });

      // Pending, workflow, and local-error overlays deliberately are not model dependencies.
      const transientOverlay = {
        error: "local validation",
        saving: true,
        workflow: "complete_remaining",
      };
      expect(transientOverlay.saving).toBe(true);

      const second = store.resolve({
        build: () => ({ key: "unexpected" }),
        dependencies: canonicalDependencies,
        key,
      });

      expect(second).toBe(first);
      expect(build).toHaveBeenCalledTimes(1);
    },
  );

  it("rebuilds a submodel when one of its canonical dependencies changes", () => {
    const store = createActiveInspectorPresentationStore();
    const first = store.resolve({
      build: () => ({ revision: "revision-1", value: 1 }),
      dependencies: ["revision-1", 1],
      key: "active-results",
    });
    const second = store.resolve({
      build: () => ({ revision: "revision-2", value: 2 }),
      dependencies: ["revision-2", 2],
      key: "active-results",
    });

    expect(second).not.toBe(first);
    expect(second).toEqual({ revision: "revision-2", value: 2 });
  });

  it("uses object identity for canonical dependency safety", () => {
    const store = createActiveInspectorPresentationStore();
    const firstState = { revision: "revision-1" };
    const secondState = { revision: "revision-2" };
    const first = store.resolve({
      build: () => ({ state: firstState }),
      dependencies: [firstState],
      key: "phase-summary",
    });
    const same = store.resolve({
      build: () => ({ state: secondState }),
      dependencies: [firstState],
      key: "phase-summary",
    });
    const rebuilt = store.resolve({
      build: () => ({ state: secondState }),
      dependencies: [secondState],
      key: "phase-summary",
    });

    expect(same).toBe(first);
    expect(rebuilt).not.toBe(first);
    expect(rebuilt.state).toBe(secondState);
  });
});
