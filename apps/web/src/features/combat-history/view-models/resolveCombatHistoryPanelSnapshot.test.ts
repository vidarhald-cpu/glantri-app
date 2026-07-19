import type { ProjectedCombatHistorySnapshot } from "@glantri/domain";
import { describe, expect, it } from "vitest";

import { resolveProjectedCombatHistoryPanelSnapshot } from "./resolveCombatHistoryPanelSnapshot";

function snapshot(input: {
  action?: string;
  id: string;
  participantId?: string;
  roundNumber?: number;
  step: ProjectedCombatHistorySnapshot["step"];
}): ProjectedCombatHistorySnapshot {
  return {
    completeness: "complete",
    id: input.id,
    panels: {
      actionResult: { status: "recorded" },
      actionSelector: input.action ? { actionLabel: input.action } : {},
      modifiers: input.action
        ? {
            dbRaw: -2,
            generalFatigueRaw: 0,
            initiativeRaw: 0,
            obSkillRaw: 0,
            rows: [],
          }
        : {},
      phase1: input.action ? { distanceLabel: `${input.action} phase 1` } : {},
      phase2: input.action ? { distanceLabel: `${input.action} phase 2` } : {},
    },
    participant: {
      displayName: input.participantId ?? "aria",
      participantId: input.participantId ?? "aria",
    },
    roundNumber: input.roundNumber ?? 1,
    step: input.step,
  };
}

describe("resolveProjectedCombatHistoryPanelSnapshot", () => {
  it("carries prior same-round participant context into a later selected step", () => {
    const declaration = snapshot({ action: "Single attack", id: "de", step: "select_actions" });
    const initiative = snapshot({ id: "i1", step: "initiative_phase_1" });

    const result = resolveProjectedCombatHistoryPanelSnapshot({
      participantId: "aria",
      roundNumber: 1,
      selectedStep: "initiative_phase_1",
      snapshots: [declaration, initiative],
    });

    expect(result?.panels.actionSelector).toEqual({ actionLabel: "Single attack" });
    expect(result?.panels.phase1).toEqual({ distanceLabel: "Single attack phase 1" });
    expect(result?.panels.phase2).toEqual({ distanceLabel: "Single attack phase 2" });
    expect(result?.panels.modifiers).toMatchObject({ dbRaw: -2 });
    expect(result?.panels.actionResult).toEqual({ status: "recorded" });
  });

  it("never uses future, other-participant, or prior-round context", () => {
    const result = resolveProjectedCombatHistoryPanelSnapshot({
      participantId: "aria",
      roundNumber: 2,
      selectedStep: "initiative_phase_1",
      snapshots: [
        snapshot({ action: "Prior round", id: "old", roundNumber: 1, step: "select_actions" }),
        snapshot({
          action: "Other participant",
          id: "other",
          participantId: "borin",
          roundNumber: 2,
          step: "select_actions",
        }),
        snapshot({ action: "Future attack", id: "future", roundNumber: 2, step: "phase_1_actions" }),
      ],
    });

    expect(result).toBeUndefined();
  });

  it("prefers exact panel facts and keeps exact Action Result separate", () => {
    const result = resolveProjectedCombatHistoryPanelSnapshot({
      participantId: "aria",
      roundNumber: 1,
      selectedStep: "initiative_phase_1",
      snapshots: [
        snapshot({ action: "Earlier", id: "de", step: "select_actions" }),
        snapshot({ action: "Exact", id: "i1", step: "initiative_phase_1" }),
        snapshot({ action: "Future", id: "a1", step: "phase_1_actions" }),
      ],
    });

    expect(result?.panels.actionSelector).toEqual({ actionLabel: "Exact" });
    expect(result?.panels.actionResult).toEqual({ status: "recorded" });
  });
});
