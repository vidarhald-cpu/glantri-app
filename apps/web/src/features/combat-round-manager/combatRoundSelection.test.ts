import { describe, expect, it } from "vitest";

import type { EncounterParticipant, EncounterSession } from "@glantri/domain";
import { encounterSessionSchema, initializeCombatRoundState } from "@glantri/domain";

import {
  getNextCombatRoundParticipantSelection,
  normalizeCombatRoundManagerSelection,
} from "./combatRoundSelection";

function participant(input: { id: string; label: string }): EncounterParticipant {
  return {
    declaration: {
      actionType: "none",
      defenseFocus: "none",
      defensePosture: "none",
      targetLocation: "any",
    },
    facing: "north",
    id: input.id,
    initiative: 0,
    label: input.label,
    order: 0,
    orientation: "neutral",
    participantType: "scenario",
    position: { x: 0, y: 0, zone: "center" },
    scenarioParticipantId: `scenario-${input.id}`,
  };
}

function encounter(input: Partial<EncounterSession> = {}): EncounterSession {
  return encounterSessionSchema.parse({
    actionLog: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    currentRound: 1,
    currentTurnIndex: 0,
    declarationsLocked: false,
    id: "encounter-1",
    kind: "combat",
    participants: [
      participant({ id: "top", label: "Top" }),
      participant({ id: "middle", label: "Middle" }),
      participant({ id: "bottom", label: "Bottom" }),
    ],
    scenarioId: "scenario-1",
    status: "active",
    title: "Selection test",
    turnOrderMode: "manual",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...input,
  });
}

describe("combat round manager selection", () => {
  it("starts fresh DE selection at the top participant despite a stale phase cursor", () => {
    const existing = initializeCombatRoundState({ encounter: encounter() });
    const state = {
      ...existing,
      currentStep: "select_actions" as const,
      phaseResolutionCursor: {
        participantId: "bottom",
        phase: "phase1" as const,
        substep: "damage" as const,
      },
      selectedParticipantId: "bottom",
      selectedStep: "select_actions" as const,
    };
    const normalized = normalizeCombatRoundManagerSelection({ state });

    expect(normalized.selectedParticipantId).toBe("top");
    expect(normalized.selectedStep).toBe("select_actions");
  });

  it("does not let stale A/P/D selected participant override fresh DE default", () => {
    const existing = initializeCombatRoundState({ encounter: encounter() });
    const state = {
      ...existing,
      currentStep: "select_actions" as const,
      selectedParticipantId: "bottom",
      selectedStep: "phase_1_damage" as const,
    };
    const normalized = normalizeCombatRoundManagerSelection({ state });

    expect(normalized.selectedParticipantId).toBe("top");
    expect(normalized.selectedStep).toBe("select_actions");
  });

  it("moves exactly one row down for DE actions without wrapping", () => {
    const participantIds = ["top", "middle", "bottom"];

    expect(
      getNextCombatRoundParticipantSelection({
        fromParticipantId: "top",
        participantIds,
        step: "select_actions",
      }),
    ).toEqual({ participantId: "middle", step: "select_actions" });
    expect(
      getNextCombatRoundParticipantSelection({
        fromParticipantId: "middle",
        participantIds,
        step: "select_actions",
      }),
    ).toEqual({ participantId: "bottom", step: "select_actions" });
    expect(
      getNextCombatRoundParticipantSelection({
        fromParticipantId: "bottom",
        participantIds,
        step: "select_actions",
      }),
    ).toEqual({ participantId: "bottom", step: "select_actions" });
  });

  it("uses the same one-row movement for modifier and initiative global steps", () => {
    const participantIds = ["top", "middle", "bottom"];

    expect(
      getNextCombatRoundParticipantSelection({
        fromParticipantId: "top",
        participantIds,
        step: "review_action_modifiers",
      }),
    ).toEqual({ participantId: "middle", step: "review_action_modifiers" });
    expect(
      getNextCombatRoundParticipantSelection({
        fromParticipantId: "top",
        participantIds,
        step: "initiative_phase_1",
      }),
    ).toEqual({ participantId: "middle", step: "initiative_phase_1" });
  });

  it("applies legacy pending post-save selection when no current cursor exists", () => {
    const existing = initializeCombatRoundState({ encounter: encounter() });
    const { currentCursor, ...legacyExisting } = existing;
    const refreshedState = {
      ...legacyExisting,
      currentStep: "select_actions" as const,
      selectedParticipantId: "bottom",
      selectedStep: "select_actions" as const,
    };
    const normalized = normalizeCombatRoundManagerSelection({
      pendingSelection: {
        participantId: "middle",
        step: "select_actions",
      },
      state: refreshedState,
    });

    expect(currentCursor).toMatchObject({ step: "DE" });
    expect(normalized.selectedParticipantId).toBe("middle");
    expect(normalized.selectedStep).toBe("select_actions");
  });

  it("uses persisted currentCursor after refresh instead of stale pending/manual selection", () => {
    const existing = initializeCombatRoundState({ encounter: encounter() });
    const refreshedState = {
      ...existing,
      currentCursor: {
        participantId: "middle",
        roundNumber: existing.roundNumber,
        step: "DE" as const,
      },
      currentStep: "select_actions" as const,
      selectedParticipantId: "bottom",
      selectedStep: "select_actions" as const,
    };
    const normalized = normalizeCombatRoundManagerSelection({
      manualSelection: {
        participantId: "bottom",
        step: "select_actions",
      },
      pendingSelection: {
        participantId: "top",
        step: "select_actions",
      },
      state: refreshedState,
    });

    expect(normalized.selectedParticipantId).toBe("middle");
    expect(normalized.selectedStep).toBe("select_actions");
  });

  it("uses a command-undo currentCursor for initiative selection after refresh", () => {
    const existing = initializeCombatRoundState({ encounter: encounter() });
    const refreshedState = {
      ...existing,
      currentCursor: {
        participantId: "top",
        roundNumber: existing.roundNumber,
        step: "i1" as const,
      },
      currentStep: "initiative_phase_1" as const,
      selectedParticipantId: "bottom",
      selectedStep: "initiative_phase_1" as const,
    };
    const normalized = normalizeCombatRoundManagerSelection({
      manualSelection: {
        participantId: "bottom",
        step: "initiative_phase_1",
      },
      pendingSelection: {
        participantId: "middle",
        step: "initiative_phase_1",
      },
      state: refreshedState,
    });

    expect(normalized.selectedParticipantId).toBe("top");
    expect(normalized.selectedStep).toBe("initiative_phase_1");
  });

  it("uses fallback-undo currentCursor after clearing an empty A1 cell", () => {
    const existing = initializeCombatRoundState({ encounter: encounter() });
    const refreshedState = {
      ...existing,
      currentCursor: {
        participantId: "middle",
        roundNumber: existing.roundNumber,
        step: "i1" as const,
      },
      currentStep: "initiative_phase_1" as const,
      selectedParticipantId: "bottom",
      selectedStep: "phase_1_actions" as const,
    };
    const normalized = normalizeCombatRoundManagerSelection({
      manualSelection: {
        participantId: "bottom",
        step: "phase_1_actions",
      },
      pendingSelection: {
        participantId: "bottom",
        step: "phase_1_actions",
      },
      state: refreshedState,
    });

    expect(normalized.selectedParticipantId).toBe("middle");
    expect(normalized.selectedStep).toBe("initiative_phase_1");
  });
});
