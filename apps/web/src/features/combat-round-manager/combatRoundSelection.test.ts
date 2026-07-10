import { describe, expect, it } from "vitest";

import type { EncounterParticipant, EncounterSession } from "@glantri/domain";
import { encounterSessionSchema, initializeCombatRoundState } from "@glantri/domain";

import {
  getCurrentCombatRoundTaskSelection,
  getCombatRoundManagerDisplayParticipantIds,
  getCombatRoundManagerInspectionSelection,
  getNextCombatRoundParticipantSelection,
  isSelectedCombatRoundStepExecutable,
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
  it("keeps participant order stable until phase initiative is complete", () => {
    const existing = initializeCombatRoundState({ encounter: encounter() });
    const partialPhase2 = {
      ...existing,
      currentStep: "phase_2_actions" as const,
      participants: existing.participants.map((participant) =>
        participant.participantId === "middle"
          ? {
              ...participant,
              initiatives: {
                phase2: {
                  baseInitiative: 0,
                  modifierAdjustment: 0,
                  rolls: [6],
                  rollTotal: 6,
                  total: 6,
                },
              },
            }
          : participant,
      ),
    };
    const completePhase2 = {
      ...partialPhase2,
      participants: partialPhase2.participants.map((participant) =>
        participant.participantId === "top"
          ? {
              ...participant,
              initiatives: {
                phase2: {
                  baseInitiative: 0,
                  modifierAdjustment: 0,
                  rolls: [3],
                  rollTotal: 3,
                  total: 3,
                },
              },
            }
          : participant.participantId === "bottom"
            ? {
                ...participant,
                initiatives: {
                  phase2: {
                    baseInitiative: 0,
                    modifierAdjustment: 0,
                    rolls: [4],
                    rollTotal: 4,
                    total: 4,
                  },
                },
              }
            : participant,
      ),
    };

    expect(getCombatRoundManagerDisplayParticipantIds(partialPhase2)).toEqual([
      "top",
      "middle",
      "bottom",
    ]);
    expect(getCombatRoundManagerDisplayParticipantIds(completePhase2)).toEqual([
      "middle",
      "bottom",
      "top",
    ]);
  });

  it("maps the current cursor to the current task selection", () => {
    const existing = initializeCombatRoundState({ encounter: encounter() });
    const state = {
      ...existing,
      currentCursor: {
        participantId: "middle",
        roundNumber: existing.roundNumber,
        step: "A1" as const,
      },
      currentStep: "phase_1_actions" as const,
      selectedParticipantId: "top",
      selectedStep: "initiative_phase_1" as const,
    };
    const currentTaskSelection = getCurrentCombatRoundTaskSelection(state);
    const inspectionSelection = getCombatRoundManagerInspectionSelection({
      manualSelection: currentTaskSelection,
      state,
    });

    expect(currentTaskSelection).toEqual({
      participantId: "middle",
      step: "phase_1_actions",
    });
    expect(inspectionSelection).toEqual({
      participantId: "middle",
      step: "phase_1_actions",
    });
    expect(state.selectedParticipantId).toBe("top");
    expect(state.selectedStep).toBe("initiative_phase_1");
  });

  it("treats non-current inspected phase cells as inspection-only", () => {
    const existing = initializeCombatRoundState({ encounter: encounter() });
    const state = {
      ...existing,
      currentCursor: {
        participantId: "middle",
        roundNumber: existing.roundNumber,
        step: "A1" as const,
      },
      currentStep: "phase_1_actions" as const,
      selectedParticipantId: "bottom",
      selectedStep: "phase_2_actions" as const,
    };

    expect(
      isSelectedCombatRoundStepExecutable({
        participantId: "middle",
        state,
        step: "phase_1_actions",
      }),
    ).toBe(true);
    expect(
      isSelectedCombatRoundStepExecutable({
        participantId: "bottom",
        state,
        step: "phase_2_actions",
      }),
    ).toBe(false);
  });

  it("keeps current task enabled for parry and damage cursors", () => {
    const existing = initializeCombatRoundState({ encounter: encounter() });

    expect(
      getCurrentCombatRoundTaskSelection({
        ...existing,
        currentCursor: {
          participantId: "middle",
          roundNumber: existing.roundNumber,
          step: "P1",
        },
        currentStep: "review_phase_2_actions",
      }),
    ).toEqual({
      participantId: "middle",
      step: "review_phase_2_actions",
    });
    expect(
      getCurrentCombatRoundTaskSelection({
        ...existing,
        currentCursor: {
          participantId: "middle",
          roundNumber: existing.roundNumber,
          step: "D1",
        },
        currentStep: "phase_1_damage",
      }),
    ).toEqual({
      participantId: "middle",
      step: "phase_1_damage",
    });
  });

  it("recovers the current task selection from a persisted phase cursor at A1", () => {
    const existing = initializeCombatRoundState({ encounter: encounter() });
    const refreshedEncounter = encounter({
      combatRoundState: {
        ...existing,
        commands: [
          {
            afterCursor: {
              participantId: "middle",
              roundNumber: existing.roundNumber,
              step: "A1",
            },
            beforeCursor: {
              participantId: "middle",
              roundNumber: existing.roundNumber,
              step: "A1",
            },
            createdAt: "2026-01-01T00:01:00.000Z",
            facts: {},
            id: "command-middle-a1",
            participantId: "middle",
            phase: "phase1",
            roundNumber: existing.roundNumber,
            step: "A1",
            type: "skip_phase_action",
          },
        ],
        currentCursor: undefined,
        currentStep: "phase_1_actions",
        phaseResolutionCursor: {
          participantId: "middle",
          phase: "phase1",
          substep: "attack",
        },
        selectedParticipantId: "bottom",
        selectedStep: "review_phase_2_actions",
      },
    });
    const state = initializeCombatRoundState({ encounter: refreshedEncounter });

    expect(state.currentCursor).toEqual({
      participantId: "middle",
      roundNumber: existing.roundNumber,
      step: "A1",
    });
    expect(getCurrentCombatRoundTaskSelection(state)).toEqual({
      participantId: "middle",
      step: "phase_1_actions",
    });
  });

  it("ignores a bare stale phase cursor in a fresh no-command encounter state", () => {
    const existing = initializeCombatRoundState({ encounter: encounter() });
    const refreshedEncounter = encounter({
      combatRoundState: {
        ...existing,
        commands: [],
        currentCursor: undefined,
        currentStep: "phase_1_actions",
        phaseResolutionCursor: {
          participantId: "middle",
          phase: "phase1",
          substep: "attack",
        },
        phaseResolutionResults: [],
        phaseResolutionStatuses: {},
        selectedParticipantId: "middle",
        selectedStep: "phase_1_actions",
        stepSnapshots: [],
      },
    });
    const state = initializeCombatRoundState({ encounter: refreshedEncounter });

    expect(state.currentStep).toBe("select_actions");
    expect(state.currentCursor).toEqual({
      participantId: "top",
      roundNumber: existing.roundNumber,
      step: "DE",
    });
    expect(state.phaseResolutionCursor).toBeUndefined();
    expect(getCurrentCombatRoundTaskSelection(state)).toEqual({
      participantId: "top",
      step: "select_actions",
    });
  });

  it("does not guess a current task when the cursor is missing or stale", () => {
    const existing = initializeCombatRoundState({ encounter: encounter() });

    expect(getCurrentCombatRoundTaskSelection({ ...existing, currentCursor: undefined })).toBe(
      undefined,
    );
    expect(
      getCurrentCombatRoundTaskSelection({
        ...existing,
        currentCursor: {
          participantId: "middle",
          roundNumber: existing.roundNumber + 1,
          step: "A1" as const,
        },
      }),
    ).toBe(undefined);
    expect(
      getCurrentCombatRoundTaskSelection({
        ...existing,
        currentCursor: {
          participantId: "missing",
          roundNumber: existing.roundNumber,
          step: "A1" as const,
        },
      }),
    ).toBe(undefined);
  });

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
    const selection = getCombatRoundManagerInspectionSelection({ state });

    expect(selection).toEqual({ participantId: "top", step: "select_actions" });
    expect(state.selectedParticipantId).toBe("bottom");
    expect(state.selectedStep).toBe("select_actions");
  });

  it("does not let stale A/P/D selected participant override fresh DE default", () => {
    const existing = initializeCombatRoundState({ encounter: encounter() });
    const state = {
      ...existing,
      currentStep: "select_actions" as const,
      selectedParticipantId: "bottom",
      selectedStep: "phase_1_damage" as const,
    };
    const selection = getCombatRoundManagerInspectionSelection({ state });

    expect(selection).toEqual({ participantId: "top", step: "select_actions" });
    expect(state.selectedParticipantId).toBe("bottom");
    expect(state.selectedStep).toBe("phase_1_damage");
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
    const selection = getCombatRoundManagerInspectionSelection({
      pendingSelection: {
        participantId: "middle",
        step: "select_actions",
      },
      state: refreshedState,
    });

    expect(currentCursor).toMatchObject({ step: "DE" });
    expect(selection).toEqual({ participantId: "middle", step: "select_actions" });
    expect(refreshedState.selectedParticipantId).toBe("bottom");
    expect(refreshedState.selectedStep).toBe("select_actions");
  });

  it("uses persisted currentCursor after refresh instead of stale persisted inspection fields", () => {
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
    const selection = getCombatRoundManagerInspectionSelection({ state: refreshedState });

    expect(selection).toEqual({ participantId: "middle", step: "select_actions" });
    expect(refreshedState.selectedParticipantId).toBe("bottom");
    expect(refreshedState.selectedStep).toBe("select_actions");
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
    const selection = getCombatRoundManagerInspectionSelection({ state: refreshedState });

    expect(selection).toEqual({ participantId: "top", step: "initiative_phase_1" });
    expect(refreshedState.selectedParticipantId).toBe("bottom");
    expect(refreshedState.selectedStep).toBe("initiative_phase_1");
  });

  it("uses the SU current cursor after refresh instead of stale persisted inspection fields", () => {
    const existing = initializeCombatRoundState({ encounter: encounter() });
    const refreshedState = {
      ...existing,
      currentCursor: {
        participantId: "middle",
        roundNumber: existing.roundNumber,
        step: "SU" as const,
      },
      currentStep: "round_summary" as const,
      selectedParticipantId: "top",
      selectedStep: "round_summary" as const,
    };
    const selection = getCombatRoundManagerInspectionSelection({ state: refreshedState });

    expect(selection).toEqual({ participantId: "middle", step: "round_summary" });
    expect(
      isSelectedCombatRoundStepExecutable({
        participantId: "middle",
        state: refreshedState,
        step: "round_summary",
      }),
    ).toBe(true);
    expect(
      isSelectedCombatRoundStepExecutable({
        participantId: "top",
        state: refreshedState,
        step: "round_summary",
      }),
    ).toBe(false);
  });

  it("keeps a manual history inspection local while canonical current task stays unchanged", () => {
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
    const selection = getCombatRoundManagerInspectionSelection({
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

    expect(selection).toEqual({ participantId: "bottom", step: "phase_1_actions" });
    expect(getCurrentCombatRoundTaskSelection(refreshedState)).toEqual({
      participantId: "middle",
      step: "initiative_phase_1",
    });
  });

  it("repairs unsupported A1 selection after refresh despite stale manual inspection", () => {
    const existing = initializeCombatRoundState({ encounter: encounter() });
    const refreshedEncounter = encounter({
      combatRoundState: {
        ...existing,
        commands: [],
        currentCursor: {
          participantId: "middle",
          roundNumber: existing.roundNumber,
          step: "A1" as const,
        },
        currentStep: "phase_1_actions" as const,
        phaseResolutionCursor: undefined,
        phaseResolutionResults: [],
        phaseResolutionStatuses: {},
        selectedParticipantId: "bottom",
        selectedStep: "initiative_phase_1" as const,
        stepSnapshots: [],
      },
    });
    const refreshedState = initializeCombatRoundState({ encounter: refreshedEncounter });
    const selection = getCombatRoundManagerInspectionSelection({
      manualSelection: {
        participantId: "bottom",
        step: "initiative_phase_1",
      },
      pendingSelection: {
        participantId: "bottom",
        step: "initiative_phase_1",
      },
      state: refreshedState,
    });

    expect(refreshedState.currentCursor).toMatchObject({ participantId: "top", step: "DE" });
    expect(selection).toEqual({ participantId: "bottom", step: "initiative_phase_1" });
    expect(refreshedState.selectedParticipantId).toBe("top");
    expect(refreshedState.selectedStep).toBe("select_actions");
  });

  it("keeps command-undo P1 current task separate from stale manual inspection", () => {
    const existing = initializeCombatRoundState({ encounter: encounter() });
    const refreshedEncounter = encounter({
      combatRoundState: {
        ...existing,
        commands: [
          {
            afterCursor: {
              participantId: "middle",
              roundNumber: existing.roundNumber,
              step: "P1",
            },
            beforeCursor: {
              participantId: "top",
              roundNumber: existing.roundNumber,
              step: "A1",
            },
            createdAt: "2026-01-01T00:01:00.000Z",
            facts: {},
            id: "command-top-attack",
            participantId: "top",
            phase: "phase1",
            roundNumber: existing.roundNumber,
            step: "A1",
            type: "roll_attack",
          },
        ],
        currentCursor: {
          participantId: "middle",
          roundNumber: existing.roundNumber,
          step: "P1" as const,
        },
        currentStep: "review_phase_2_actions" as const,
        selectedParticipantId: "middle",
        selectedStep: "review_phase_2_actions" as const,
      },
    });
    const refreshedState = initializeCombatRoundState({ encounter: refreshedEncounter });
    const selection = getCombatRoundManagerInspectionSelection({
      manualSelection: {
        participantId: "bottom",
        step: "initiative_phase_1",
      },
      pendingSelection: {
        participantId: "bottom",
        step: "initiative_phase_1",
      },
      state: refreshedState,
    });

    expect(selection).toEqual({ participantId: "bottom", step: "initiative_phase_1" });
    expect(getCurrentCombatRoundTaskSelection(refreshedState)).toEqual({
      participantId: "middle",
      step: "review_phase_2_actions",
    });
  });
});
