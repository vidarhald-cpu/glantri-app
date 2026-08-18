import { describe, expect, it } from "vitest";

import type {
  CombatParryModifierValidationProjection,
  CombatProgressionPresentationTask,
} from "@glantri/domain";

import { buildCombatParryModifierRequest } from "./combatParryModifierRequest";

const task = {
  actorAccess: { combatant: true, gm: true },
  automation: {
    authority: { kind: "unknown" },
    eligibility: "unsupported",
    schemaVersion: 1,
    taskId: "parry-task",
    warnings: [],
    workClass: "not_applicable",
  },
  contributesToProgression: true,
  executionGroupId: "parry-group",
  expectedCommand: "roll_parry",
  id: "parry-task",
  identity: {
    attackResultId: "attack-result",
    attackerParticipantId: "attacker",
    defenderParticipantId: "defender",
    executionGroupId: "parry-group",
    initiativeGroupId: "round:2:phase:phase1:initiative:6",
    initiativeValue: 6,
    opportunityId: "opportunity",
    parryPurpose: "ordinary_defense",
    parrySourceId: "auto",
    phase: "phase1",
  },
  kind: "parry",
  owner: { kind: "combatant", label: "Defender", participantId: "defender" },
  processId: "attack-process",
  stageId: "defense-stage",
  state: "executable",
  trackerFacet: {
    owner: { kind: "combatant", label: "Defender", participantId: "defender" },
    step: "P1",
  },
} satisfies CombatProgressionPresentationTask;

const validation = {
  attackResultId: "attack-result",
  attackResultModifier: -3,
  attackerParticipantId: "attacker",
  dbParryRaw: -6,
  defenderModifierFingerprint: "v1:defender",
  defenderParticipantId: "defender",
  effectCutoffInitiativeGroupId: task.identity.initiativeGroupId,
  encounterId: "encounter",
  expectedRevision: "2026-07-25T10:00:00.000Z",
  initiativeGroupId: task.identity.initiativeGroupId,
  initiativeValue: task.identity.initiativeValue,
  opportunityId: "opportunity",
  parryPurpose: "ordinary_defense",
  parrySourceId: "auto",
  processId: task.processId,
  stageId: task.stageId,
  taskId: task.id,
} satisfies CombatParryModifierValidationProjection;

const input = {
  attackResultId: "attack-result",
  attackerParticipantId: "attacker",
  defenderParticipantId: "defender",
  encounterId: "encounter",
  encounterRevision: validation.expectedRevision,
  opportunityId: "opportunity",
  parryPurpose: "ordinary_defense" as const,
  parrySourceId: "auto",
  processId: task.processId,
  stageId: task.stageId,
  task,
  validation,
};

describe("buildCombatParryModifierRequest", () => {
  it("uses the exact canonical task, effect cutoff, fingerprint, and attack-result modifier", () => {
    expect(buildCombatParryModifierRequest(input)).toEqual({
      attackResultModifier: -3,
      dbParryRaw: -6,
      defenderModifierFingerprint: "v1:defender",
      effectCutoffInitiativeGroupId: task.identity.initiativeGroupId,
      expectedRevision: validation.expectedRevision,
      initiativeGroupId: task.identity.initiativeGroupId,
      initiativeValue: 6,
      modifierValidationTaskId: task.id,
    });
  });

  it.each([
    ["revision", { encounterRevision: "stale" }],
    ["task", { task: { ...task, id: "old-parry-task" } }],
    ["opportunity", { opportunityId: "other-opportunity" }],
    [
      "effect cutoff",
      {
        validation: {
          ...validation,
          effectCutoffInitiativeGroupId: "round:2:phase:phase1:initiative:7",
        },
      },
    ],
    ["purpose", { parryPurpose: "offensive_parry" as const }],
  ])("fails closed for a mismatched %s", (_label, override) => {
    expect(buildCombatParryModifierRequest({ ...input, ...override })).toBeUndefined();
  });
});
