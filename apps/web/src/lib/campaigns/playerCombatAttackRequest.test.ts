import { describe, expect, it } from "vitest";

import type {
  CombatAttackModifierValidationProjection,
  CombatProgressionPresentationTask,
} from "@glantri/domain";

import { buildPlayerCombatAttackModifierRequest } from "./playerCombatAttackRequest";

const task = {
  actorAccess: { combatant: true, gm: true },
  contributesToProgression: true,
  executionGroupId: "attack-group",
  id: "attack-task",
  identity: { executionGroupId: "attack-group", phase: "phase1" },
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
  attackerModifierFingerprint: "v1:82d757a9",
  attackerParticipantId: "encounter-attacker",
  defenderDbParryRaw: -2,
  defenderModifierFingerprint: "v1:920ced12",
  defenderParticipantId: "encounter-defender",
  encounterId: "encounter-1",
  expectedRevision: "2026-07-20T10:00:00.000Z",
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
      attackerModifierFingerprint: validation.attackerModifierFingerprint,
      defenderDbParryRaw: -2,
      defenderModifierFingerprint: validation.defenderModifierFingerprint,
      expectedRevision: validation.expectedRevision,
      modifierValidationTaskId: task.id,
      obSkillRaw: -2,
    });
  });

  it.each([
    ["revision", { encounterRevision: "2026-07-20T09:59:59.000Z" }],
    ["task", { task: { ...task, id: "future-attack-task" } }],
    ["opponent", { defenderParticipantId: "another-opponent" }],
    ["phase", { phase: "phase2" as const }],
  ])("fails closed when the %s context changes", (_label, override) => {
    expect(buildPlayerCombatAttackModifierRequest({ ...input, ...override })).toBeUndefined();
  });
});
