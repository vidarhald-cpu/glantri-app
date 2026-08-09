import { describe, expect, it } from "vitest";

import type {
  CombatAttackModifierValidationProjection,
  CombatProgressionPresentationTask,
} from "@glantri/domain";

import { buildPlayerCombatAttackModifierRequest } from "./playerCombatAttackRequest";

const task = {
  actorAccess: { combatant: true, gm: true },
  automation: {
    authority: { kind: "unknown" },
    eligibility: "unsupported",
    schemaVersion: 1,
    taskId: "attack-task",
    warnings: [],
    workClass: "not_applicable",
  },
  contributesToProgression: true,
  executionGroupId: "attack-group",
  expectedCommand: "roll_attack",
  id: "attack-task",
  identity: {
    executionGroupId: "attack-group",
    initiativeGroupId: "round:1:phase:phase1:initiative:7",
    initiativeValue: 7,
    phase: "phase1",
  },
  kind: "attack",
  owner: { kind: "combatant", label: "Gladiator", participantId: "encounter-attacker" },
  processId: "attack-process",
  stageId: "attack-stage",
  state: "executable",
  trackerFacet: {
    owner: { kind: "combatant", label: "Gladiator", participantId: "encounter-attacker" },
    step: "A1",
  },
} satisfies CombatProgressionPresentationTask;

const validation = {
  actionId: "attack_parry",
  attackContextAvailability: "complete",
  attackerModifierFingerprint: "v1:82d757a9",
  attackerParticipantId: "encounter-attacker",
  defenderParticipantId: "encounter-defender",
  effectCutoffInitiativeGroupId: task.identity.initiativeGroupId,
  encounterId: "encounter-1",
  expectedRevision: "2026-07-20T10:00:00.000Z",
  initiativeGroupId: task.identity.initiativeGroupId,
  initiativeValue: task.identity.initiativeValue,
  obSkillRaw: -2,
  opportunityId: "attack-opportunity",
  pairKey: "participant-attacker::participant-defender",
  phase: "phase1",
  taskId: task.id,
} satisfies CombatAttackModifierValidationProjection;

const input = {
  attackerParticipantId: "encounter-attacker",
  defenderParticipantId: "encounter-defender",
  encounterId: "encounter-1",
  encounterRevision: validation.expectedRevision,
  phase: "phase1" as const,
  task,
  validation,
};

describe("buildPlayerCombatAttackModifierRequest", () => {
  it("uses the canonical modifier values bound to the displayed attack task", () => {
    expect(buildPlayerCombatAttackModifierRequest(input)).toEqual({
      effectCutoffInitiativeGroupId: validation.effectCutoffInitiativeGroupId,
      expectedRevision: validation.expectedRevision,
      initiativeGroupId: validation.initiativeGroupId,
      initiativeValue: validation.initiativeValue,
      modifierValidationTaskId: task.id,
    });
  });

  it.each([
    [
      "required attack context",
      {
        validation: {
          ...validation,
          attackContextAvailability: "unavailable_required" as const,
        },
      },
    ],
    ["revision", { encounterRevision: "2026-07-20T09:59:59.000Z" }],
    ["task", { task: { ...task, id: "future-attack-task" } }],
    [
      "initiative group",
      {
        validation: {
          ...validation,
          initiativeGroupId: "round:1:phase:phase1:initiative:6",
        },
      },
    ],
    ["opponent", { defenderParticipantId: "another-opponent" }],
    ["phase", { phase: "phase2" as const }],
  ])("fails closed when the %s context changes", (_label, override) => {
    expect(buildPlayerCombatAttackModifierRequest({ ...input, ...override })).toBeUndefined();
  });
});
