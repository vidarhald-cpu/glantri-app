import {
  combatRoundStateSchema,
  combatStepEventSchema,
  type CombatRoundStepSnapshot,
} from "@glantri/domain";
import { describe, expect, it, vi } from "vitest";

import { createEmptyPlayerEncounterCombatContext } from "@/lib/campaigns/playerEncounter";
import { buildArchivedInspectorPresentationIndex } from "./archivedInspectorPresentation";

function snapshot(input: Partial<CombatRoundStepSnapshot> = {}): CombatRoundStepSnapshot {
  return {
    committedAt: "2026-07-28T10:00:00.000Z",
    id: "snapshot-1",
    participantId: "participant-1",
    participantLabel: "Archived participant",
    roundNumber: 1,
    step: "phase_1_actions",
    ...input,
  };
}

function archivedRound(
  input: {
    modifierTotal?: number;
    snapshotId?: string;
  } = {},
) {
  return combatRoundStateSchema.parse({
    currentStep: "round_summary",
    participants: [
      {
        label: "Archived participant",
        participantId: "participant-1",
      },
    ],
    roundNumber: 1,
    stepSnapshots: [
      snapshot({
        id: input.snapshotId ?? "snapshot-1",
        modifierSummary: {
          dbRaw: 0,
          generalFatigueRaw: 0,
          initiativeRaw: 0,
          obSkillRaw: input.modifierTotal ?? 3,
          rows: [
            {
              bucketKey: "situation_ob_skill",
              entries: [],
              label: "Skill/OB",
              total: input.modifierTotal ?? 3,
            },
          ],
        },
        phasePanels: {
          phase1: {
            attackSummary: {
              attackMode: "Slash",
              dmb: "2",
              initiative: "4",
              maxCrits: "C",
              ob: "17",
              weaponName: "Archived sword",
            },
            defenseSummary: {
              db: "12",
              dm: "1",
              parry: "8",
              sourceName: "Archived shield",
            },
            phaseContext: createEmptyPlayerEncounterCombatContext(),
            targetOptions: [],
          },
        },
      }),
    ],
  });
}

describe("archived inspector presentation ownership", () => {
  it("builds immutable candidates once and reuses them across selection changes", () => {
    const buildHistoricalActionResult = vi.fn(() => ({
      interpretedResult: "Archived result",
    }));
    const index = buildArchivedInspectorPresentationIndex({
      buildHistoricalActionResult,
      roundStates: [archivedRound()],
    });

    const first = index.get({
      participantId: "participant-1",
      roundNumber: 1,
      step: "phase_1_actions",
    });
    index.get({
      participantId: "participant-1",
      roundNumber: 1,
      step: "review_phase_2_actions",
    });
    const reselected = index.get({
      participantId: "participant-1",
      roundNumber: 1,
      step: "phase_1_actions",
    });

    expect(reselected).toBe(first);
    expect(reselected?.modifierRows[0]?.total).toBe(3);
    expect(reselected?.phasePanels.phase1?.attackRows?.weaponName).toBe("Archived sword");
    expect(reselected?.phasePanels.phase1?.defenseRows?.sourceName).toBe("Archived shield");
  });

  it("replaces snapshot-owned models when archive identity is replaced", () => {
    const buildHistoricalActionResult = () => ({ interpretedResult: "Archived result" });
    const first = buildArchivedInspectorPresentationIndex({
      buildHistoricalActionResult,
      roundStates: [archivedRound({ modifierTotal: 3, snapshotId: "snapshot-1" })],
    }).get({
      participantId: "participant-1",
      roundNumber: 1,
      step: "phase_1_actions",
    });
    const replaced = buildArchivedInspectorPresentationIndex({
      buildHistoricalActionResult,
      roundStates: [archivedRound({ modifierTotal: 7, snapshotId: "snapshot-2" })],
    }).get({
      participantId: "participant-1",
      roundNumber: 1,
      step: "phase_1_actions",
    });

    expect(replaced).not.toBe(first);
    expect(first?.modifierRows[0]?.total).toBe(3);
    expect(replaced?.modifierRows[0]?.total).toBe(7);
  });

  it("does not consult active participant facts for historical snapshots", () => {
    const archived = archivedRound();
    const index = buildArchivedInspectorPresentationIndex({
      buildHistoricalActionResult: () => ({ interpretedResult: "Archived result" }),
      roundStates: [archived],
    });
    const candidate = index.get({
      participantId: "participant-1",
      roundNumber: 1,
      step: "phase_1_actions",
    });

    expect(candidate?.inspector.participant?.label).toBe("Archived participant");
    expect(candidate?.panelSnapshot?.phasePanels?.phase1?.attackSummary?.ob).toBe("17");
    expect(candidate?.canonicalActionResultEvents).toEqual([]);
  });

  it("recovers a missing historical selector from the archived declaration event and round", () => {
    const declarationEvent = combatStepEventSchema.parse({
      actorParticipantId: "participant-1",
      completeness: "complete",
      encounterId: "encounter-1",
      facts: {
        involvedOutcome: {
          actionId: "single_attack",
          movementId: "maintain_distance",
        },
      },
      id: "declaration-1",
      occurredAt: "2026-07-28T09:00:00.000Z",
      ownerParticipantId: "participant-1",
      roundNumber: 1,
      schemaVersion: 1,
      sequence: 1,
      source: { kind: "canonical", sourceIds: [] },
      status: "recorded",
      step: "select_actions",
      type: "declaration",
      visibility: {
        identityRefs: [{ participantId: "participant-1", role: "actor" }],
        involvedParticipantIds: ["participant-1"],
        outcomeScope: "involved",
      },
    });
    const round = combatRoundStateSchema.parse({
      currentStep: "round_summary",
      events: [declarationEvent],
      participants: [
        {
          declaration: {
            actionId: "single_attack",
            additionalActionNotes: "Hold the line",
            movementId: "maintain_distance",
            roundNumber: 1,
            submittedBy: "gm",
          },
          label: "Archived participant",
          participantId: "participant-1",
        },
      ],
      roundNumber: 1,
      stepSnapshots: [
        snapshot({
          declarationSummary: undefined,
          id: "snapshot-without-declaration",
          step: "review_action_modifiers",
        }),
      ],
    });

    const candidate = buildArchivedInspectorPresentationIndex({
      buildHistoricalActionResult: () => ({ interpretedResult: "Archived result" }),
      roundStates: [round],
    }).get({
      participantId: "participant-1",
      roundNumber: 1,
      step: "review_action_modifiers",
    });

    expect(candidate?.panelSnapshot?.declarationSummary).toMatchObject({
      actionId: "single_attack",
      additionalActionNotes: "Hold the line",
      movementId: "maintain_distance",
    });
  });
});
