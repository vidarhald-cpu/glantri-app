import { describe, expect, it } from "vitest";

import type {
  CombatAttackModifierValidationProjection,
  CombatProgressionPresentationTask,
} from "@glantri/domain";

import { projectPlayerCombatAttackContextAvailability } from "./playerCombatAttackContext";

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
    attackerParticipantId: "combatant-attacker",
    defenderParticipantId: "combatant-defender",
    executionGroupId: "attack-group",
    initiativeGroupId: "round:1:phase:phase1:initiative:7",
    initiativeValue: 7,
    opportunityId: "attack-opportunity",
    phase: "phase1",
  },
  kind: "attack",
  owner: { kind: "combatant", label: "The Gladiator", participantId: "combatant-attacker" },
  processId: "attack-process",
  stageId: "attack-stage",
  state: "executable",
  trackerFacet: {
    owner: {
      kind: "combatant",
      label: "The Gladiator",
      participantId: "combatant-attacker",
    },
    step: "A1",
  },
} satisfies CombatProgressionPresentationTask;

const validation = {
  actionId: "attack_parry",
  attackContextAvailability: "complete",
  attackerModifierFingerprint: "v1:attacker",
  attackerParticipantId: "combatant-attacker",
  defenderParticipantId: "combatant-defender",
  effectCutoffInitiativeGroupId: task.identity.initiativeGroupId,
  encounterId: "encounter-1",
  expectedRevision: "revision-2",
  initiativeGroupId: task.identity.initiativeGroupId,
  initiativeValue: task.identity.initiativeValue,
  obSkillRaw: 0,
  opportunityId: "attack-opportunity",
  pairKey: "participant-attacker::participant-defender",
  phase: "phase1",
  taskId: "attack-task",
} satisfies CombatAttackModifierValidationProjection;

const completeInput = {
  attackerParticipantId: "combatant-attacker",
  attackSourceAvailable: true,
  defenderParticipantId: "combatant-defender",
  encounterId: "encounter-1",
  encounterRevision: "revision-2",
  historyRevision: "revision-2",
  refreshPending: false,
  task,
  validation,
};

describe("player combat attack-context availability", () => {
  it("accepts only one exact revision-bound attacker, defender, task, and opportunity", () => {
    expect(projectPlayerCombatAttackContextAvailability(completeInput)).toEqual({
      status: "complete",
    });
  });

  it("treats a mixed revision or mismatched combatant identity as stale", () => {
    expect(
      projectPlayerCombatAttackContextAvailability({
        ...completeInput,
        historyRevision: "revision-1",
      }),
    ).toMatchObject({ status: "stale" });
    expect(
      projectPlayerCombatAttackContextAvailability({
        ...completeInput,
        attackerParticipantId: "combatant-someone-else",
      }),
    ).toMatchObject({ status: "stale" });
    expect(
      projectPlayerCombatAttackContextAvailability({
        ...completeInput,
        defenderParticipantId: "combatant-someone-else",
      }),
    ).toMatchObject({ status: "stale" });
  });

  it.each([
    ["task", { validation: { ...validation, taskId: "future-attack-task" } }],
    ["opportunity", { validation: { ...validation, opportunityId: "future-opportunity" } }],
    [
      "initiative group",
      { validation: { ...validation, initiativeGroupId: "round:1:phase:phase1:initiative:6" } },
    ],
    ["initiative value", { validation: { ...validation, initiativeValue: 6 } }],
    [
      "effect cutoff",
      {
        validation: {
          ...validation,
          effectCutoffInitiativeGroupId: "round:1:phase:phase1:initiative:6",
        },
      },
    ],
  ])("treats a mismatched %s identity as stale", (_label, override) => {
    expect(
      projectPlayerCombatAttackContextAvailability({ ...completeInput, ...override }),
    ).toMatchObject({ status: "stale" });
  });

  it("distinguishes loading from a required canonical input that is unavailable", () => {
    expect(
      projectPlayerCombatAttackContextAvailability({
        ...completeInput,
        refreshPending: true,
      }),
    ).toEqual({ message: "Loading attack context…", status: "loading" });
    expect(
      projectPlayerCombatAttackContextAvailability({
        ...completeInput,
        validation: {
          ...validation,
          attackContextAvailability: "unavailable_required",
        },
      }),
    ).toMatchObject({ status: "unavailable_required" });
  });

  it("does not make an absent broader presentation summary a task prerequisite", () => {
    expect(projectPlayerCombatAttackContextAvailability(completeInput)).not.toHaveProperty(
      "defenderSummary",
    );
    expect(validation).not.toHaveProperty("defenderInventory");
  });
});
