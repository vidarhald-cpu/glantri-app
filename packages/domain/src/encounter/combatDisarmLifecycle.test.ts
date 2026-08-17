import { describe, expect, it } from "vitest";

import type { CombatDisarmRoll } from "./combatDisarm";
import type { EncounterParticipant } from "./session";
import {
  commitCombatRoundDisarm,
  initializeCombatRoundState,
  openCombatRoundDisarmAfterContact,
  recordCombatRoundDeclaration,
  recordCombatRoundDisarmRoll,
  undoLatestCombatRoundCommand,
} from "./combatRoundManager";

const NOW = "2026-08-17T10:00:00.000Z";
const ITEM_REVISION = "2026-08-17T09:00:00.000Z";

function participant(id: string): EncounterParticipant {
  return {
    declaration: {
      actionType: "none",
      defenseFocus: "none",
      defensePosture: "none",
      targetLocation: "any",
    },
    facing: "north",
    id,
    initiative: 0,
    label: id,
    order: 0,
    orientation: "neutral",
    participantType: "scenario",
    position: { x: 0, y: 0, zone: "center" },
    scenarioParticipantId: `scenario-${id}`,
  };
}

function disarmRoll(input: {
  finalTotal: number;
  participantId: string;
  role: "disarm_actor" | "disarm_holder";
}): CombatDisarmRoll {
  return {
    calculation: {
      baseSkill: 10,
      calculationId: `calculation:${input.participantId}`,
      completeness: "complete",
      contestType: "disarm",
      derivedIntegerAdjustment: input.finalTotal - 20,
      finalResult: input.finalTotal,
      governingStat: { id: "strength", label: "Strength", value: 10 },
      missingContributionPoints: [],
      openEndedDie: { openEndedD10s: [], rollD20: 10, rollTotal: 10 },
      opponentParticipantId: input.participantId === "actor" ? "holder" : "actor",
      participantId: input.participantId,
      percentageContributions: [],
      preDieTotal: input.finalTotal - 10,
      role: input.role,
      skill: { id: "weapon-skill", label: "Weapon skill", totalXp: 0 },
      totalPercentageAdjustment: 0,
      visibility: "roller_and_gm",
    },
    characteristicChoice: "strength",
    finalTotal: input.finalTotal,
    id: `roll:${input.participantId}`,
    participantId: input.participantId,
    rolledAt: NOW,
    skillChoice: "weapon_skill",
  };
}

describe("combat Disarm lifecycle", () => {
  it("persists contact, separate rolls, exact forced-drop intent, condition, reload, and undo", () => {
    let state = initializeCombatRoundState({
      encounter: {
        currentRound: 3,
        id: "encounter-1",
        participants: [participant("actor"), participant("holder")],
      },
    });
    state = recordCombatRoundDeclaration({
      command: { commandId: "declare", createdAt: NOW },
      declaration: {
        actionId: "disarm",
        disarm: {
          actingWeapon: {
            capability: "trap",
            controlRating: 2,
            itemId: "item-main-gauche",
            itemRevision: ITEM_REVISION,
            label: "Main gauche",
            parryModifier: 2,
            templateId: "weapon-main-gauche",
          },
          method: "proactive",
          phase: "phase1",
          targetParticipantId: "holder",
          targetWeapon: {
            capability: "none",
            controlRating: 3,
            itemId: "item-spear",
            itemRevision: ITEM_REVISION,
            label: "Spear",
            parryModifier: -1,
            templateId: "weapon-spear-thrust",
          },
        },
        roundNumber: 3,
      },
      participantId: "actor",
      state,
      submittedBy: "player",
    });

    const attemptId = state.disarmAttempts[0]!.id;
    expect(state.disarmAttempts[0]).toMatchObject({
      actingWeaponItemId: "item-main-gauche",
      status: "awaiting_contact",
      targetWeaponItemId: "item-spear",
      targetWeaponItemRevision: ITEM_REVISION,
    });
    state = initializeCombatRoundState({
      encounter: {
        combatRoundState: state,
        currentRound: 3,
        id: "encounter-1",
        participants: [participant("actor"), participant("holder")],
      },
    });
    state = openCombatRoundDisarmAfterContact({
      attackResultId: "attack:actor:phase1",
      attemptId,
      command: { commandId: "contact", createdAt: NOW },
      state,
    });
    state = recordCombatRoundDisarmRoll({
      attemptId,
      command: { commandId: "actor-roll", createdAt: NOW },
      result: disarmRoll({ finalTotal: 31, participantId: "actor", role: "disarm_actor" }),
      state,
    });
    state = recordCombatRoundDisarmRoll({
      attemptId,
      command: { commandId: "holder-roll", createdAt: NOW },
      result: disarmRoll({ finalTotal: 15, participantId: "holder", role: "disarm_holder" }),
      state,
    });

    expect(state.disarmAttempts[0]).toMatchObject({
      difference: 16,
      result: { disarmed: true, unbalanced: true },
      status: "awaiting_commit",
    });
    state = commitCombatRoundDisarm({
      attemptId,
      command: { commandId: "commit", createdAt: NOW },
      state,
    });

    expect(state.disarmAttempts[0]!.status).toBe("committed");
    expect(state.disarmUnbalancedConditions[0]).toMatchObject({
      affectedParticipantId: "holder",
      expiresAfterRound: 4,
      modifierValue: -2,
      sourceDisarmAttemptId: attemptId,
    });
    expect(state.events.at(-1)).toMatchObject({
      facts: {
        involvedOutcome: { disarmed: true, noDirectDamage: true, unbalanced: true },
      },
      source: {
        sourceIds: expect.arrayContaining([attemptId, "item-spear"]),
      },
      type: "disarm_committed",
    });

    const undone = undoLatestCombatRoundCommand({ state });
    expect(undone?.disarmAttempts[0]!.status).toBe("awaiting_commit");
    expect(undone?.disarmUnbalancedConditions).toEqual([]);
    expect(undone?.events.some((event) => event.commandId === "commit")).toBe(false);
  });
});
