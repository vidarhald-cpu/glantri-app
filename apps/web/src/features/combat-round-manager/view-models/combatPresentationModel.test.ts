import { describe, expect, it, vi } from "vitest";

import type { CombatTrackerModel } from "@/features/combat-history";
import {
  applyCombatTrackerSelectionOverlay,
  buildCombatPendingOverlay,
  buildCombatTrackerBasePresentation,
  createCombatPresentationLayerCache,
  type ActiveCombatPresentation,
  type ArchivedCombatPresentation,
  type CombatSelectionOverlay,
} from "./combatPresentationModel";

function active(identity: string): ActiveCombatPresentation {
  return { identity } as ActiveCombatPresentation;
}

function archived(identity: string): ArchivedCombatPresentation {
  return { identity } as ArchivedCombatPresentation;
}

function selection(identity: string): CombatSelectionOverlay {
  return {
    identity,
    renderedInspectionSelection: {
      participantId: "participant-1",
      step: "select_actions",
    },
    selectedRoundIsActive: true,
    selectedRoundNumber: 2,
  } as CombatSelectionOverlay;
}

function tracker(): CombatTrackerModel {
  return {
    cells: {
      "2:participant-1:select_actions": {
        attention: "ordinary",
        cellKey: "2:participant-1:select_actions",
        completed: false,
        current: true,
        executable: true,
        executionGroupIds: [],
        gmProxyAvailable: false,
        historical: false,
        hover: {
          actionLabel: "Declaration",
          gmActionRequired: true,
          text: "Declaration pending.",
          waiting: false,
        },
        hoverText: "Declaration pending.",
        initiativeValue: false,
        inspectable: true,
        marker: "?",
        markerKind: "required",
        ownerParticipantIds: ["participant-1"],
        participantId: "participant-1",
        processIds: [],
        roundNumber: 2,
        selected: false,
        stageIds: [],
        status: "open",
        step: "select_actions",
        taskIds: [],
        taskKinds: [],
        waiting: false,
      },
    },
    currentTaskCellKey: "2:participant-1:select_actions",
    legend: [],
    rounds: [{ currentStep: "select_actions", roundNumber: 2 }],
    rows: [{ label: "Participant", participantId: "participant-1", selected: false }],
    steps: ["select_actions"],
  };
}

describe("combat presentation model layers", () => {
  it("reuses archived presentation when active revision and selection change", () => {
    const cache = createCombatPresentationLayerCache();
    const buildArchive = vi.fn(() => archived("archive-1"));
    const first = cache.resolveArchived("archive-1", buildArchive);

    cache.resolveActive("revision-1", () => active("revision-1"));
    cache.resolveSelection("selection-1", () => selection("selection-1"));
    cache.resolveActive("revision-2", () => active("revision-2"));
    cache.resolveSelection("selection-2", () => selection("selection-2"));
    const second = cache.resolveArchived("archive-1", buildArchive);

    expect(second).toBe(first);
    expect(buildArchive).toHaveBeenCalledTimes(1);
  });

  it("rebuilds active presentation only when active revision identity changes", () => {
    const cache = createCombatPresentationLayerCache();
    const buildFirst = vi.fn(() => active("revision-1"));
    const first = cache.resolveActive("revision-1", buildFirst);
    const same = cache.resolveActive("revision-1", () => active("unexpected"));
    const buildSecond = vi.fn(() => active("revision-2"));
    const second = cache.resolveActive("revision-2", buildSecond);

    expect(same).toBe(first);
    expect(second).not.toBe(first);
    expect(buildFirst).toHaveBeenCalledTimes(1);
    expect(buildSecond).toHaveBeenCalledTimes(1);
  });

  it("replaces the active inspector owner with the active revision", () => {
    const cache = createCombatPresentationLayerCache();
    const firstInspectorPresentation = { resolve: vi.fn() };
    const secondInspectorPresentation = { resolve: vi.fn() };
    const first = cache.resolveActive("revision-1", () => ({
      ...active("revision-1"),
      inspectorPresentation: firstInspectorPresentation,
    }));
    const same = cache.resolveActive("revision-1", () => ({
      ...active("unexpected"),
      inspectorPresentation: secondInspectorPresentation,
    }));
    const second = cache.resolveActive("revision-2", () => ({
      ...active("revision-2"),
      inspectorPresentation: secondInspectorPresentation,
    }));

    expect(same.inspectorPresentation).toBe(firstInspectorPresentation);
    expect(second.inspectorPresentation).toBe(secondInspectorPresentation);
    expect(second.inspectorPresentation).not.toBe(first.inspectorPresentation);
  });

  it("rebuilds selection independently and only overlays the selected tracker cell", () => {
    const cache = createCombatPresentationLayerCache();
    const activeLayer = cache.resolveActive("revision-1", () => active("revision-1"));
    const archiveLayer = cache.resolveArchived("archive-1", () => archived("archive-1"));
    const base = tracker();
    const overlay = selection("selection-1");
    const selected = applyCombatTrackerSelectionOverlay({ base, selection: overlay });

    expect(selected).not.toBe(base);
    expect(selected.cells["2:participant-1:select_actions"]?.selected).toBe(true);
    expect(base.cells["2:participant-1:select_actions"]?.selected).toBe(false);
    expect(cache.resolveActive("revision-1", () => active("unexpected"))).toBe(activeLayer);
    expect(cache.resolveArchived("archive-1", () => archived("unexpected"))).toBe(archiveLayer);
  });

  it("keeps pending workflow state outside active and archived presentation", () => {
    const cache = createCombatPresentationLayerCache();
    const activeLayer = cache.resolveActive("revision-1", () => active("revision-1"));
    const archiveLayer = cache.resolveArchived("archive-1", () => archived("archive-1"));

    const idle = buildCombatPendingOverlay({
      saving: false,
      workflow: "perform",
    });
    const saving = buildCombatPendingOverlay({
      saving: true,
      workflow: "complete_remaining",
    });

    expect(saving).not.toBe(idle);
    expect(saving.saving).toBe(true);
    expect(cache.resolveActive("revision-1", () => active("unexpected"))).toBe(activeLayer);
    expect(cache.resolveArchived("archive-1", () => archived("unexpected"))).toBe(archiveLayer);
  });

  it("reuses the tracker base across selection changes", () => {
    const cache = createCombatPresentationLayerCache();
    const buildBase = vi.fn(tracker);
    const base = cache.resolveTrackerBase("archive-1:revision-1", buildBase);

    cache.resolveSelection("selection-1", () => selection("selection-1"));
    cache.resolveSelection("selection-2", () => selection("selection-2"));

    expect(cache.resolveTrackerBase("archive-1:revision-1", buildBase)).toBe(base);
    expect(buildBase).toHaveBeenCalledTimes(1);
  });

  it("composes a new active tracker without rebuilding archived tracker cells", () => {
    const historicalCell = {
      ...tracker().cells["2:participant-1:select_actions"]!,
      cellKey: "1:participant-1:select_actions",
      historical: true,
      roundNumber: 1,
    };
    const archivedLayer = {
      identity: "archive-1",
      roundNumbers: [1],
      roundStates: [],
      tracker: {
        ...tracker(),
        cells: { "1:participant-1:select_actions": historicalCell },
        rounds: [{ roundNumber: 1 }],
      },
      trackerCellFacts: [],
    } as unknown as ArchivedCombatPresentation;
    const firstActive = {
      ...active("revision-1"),
      roundState: { currentStep: "select_actions", roundNumber: 2 },
      tracker: tracker(),
    } as ActiveCombatPresentation;
    const secondActive = {
      ...firstActive,
      identity: "revision-2",
      tracker: {
        ...tracker(),
        currentTaskCellKey: undefined,
      },
    } as ActiveCombatPresentation;

    const first = buildCombatTrackerBasePresentation({
      active: firstActive,
      archived: archivedLayer,
    });
    const second = buildCombatTrackerBasePresentation({
      active: secondActive,
      archived: archivedLayer,
    });

    expect(first.cells["1:participant-1:select_actions"]).toBe(historicalCell);
    expect(second.cells["1:participant-1:select_actions"]).toBe(historicalCell);
  });
});
