import { describe, expect, it } from "vitest";

import {
  projectCombatProgressionPresentation,
  type CombatAttackModifierValidationProjection,
  type CombatProgressionProjection,
  type CombatProgressionTask,
} from "@glantri/domain";

import { projectPlayerCombatAttackContextAvailability } from "./playerCombatAttackContext";
import { buildPlayerCombatAttackModifierRequest } from "./playerCombatAttackRequest";

const canonicalTask = {
  allowedActors: ["combatant", "gm"],
  automation: {
    authority: { kind: "player", participantId: "encounter-attacker" },
    eligibility: "eligible",
    schemaVersion: 1,
    taskId: "attack-task",
    warnings: [],
    workClass: "player_roll",
  },
  blockerIds: [],
  executionGroupId: "attack-group",
  expectedCommand: "roll_attack",
  id: "attack-task",
  identity: {
    actionId: "attack_parry",
    attackIndex: 1,
    attackerParticipantId: "encounter-attacker",
    declarationId: "attack-declaration",
    defenderParticipantId: "encounter-defender",
    executionGroupId: "attack-group",
    initiativeGroupId: "round:1:phase:phase1:initiative:7",
    initiativeValue: 7,
    opportunityId: "attack-opportunity",
    phase: "phase1",
  },
  kind: "attack",
  opponent: { kind: "combatant", label: "Defender", participantId: "encounter-defender" },
  owner: { kind: "combatant", label: "Attacker", participantId: "encounter-attacker" },
  processId: "attack-process",
  stageId: "attack-stage",
  state: "executable",
  trackerFacet: {
    owner: { kind: "combatant", label: "Attacker", participantId: "encounter-attacker" },
    step: "A1",
  },
} satisfies CombatProgressionTask;

const canonicalProjection = {
  blockers: [],
  boundary: {
    blockerIds: [],
    id: "round:1:phase1-resolution",
    kind: "phase1_resolution",
    processes: [
      {
        boundaryId: "round:1:phase1-resolution",
        id: "attack-process",
        kind: "attack",
        stages: [
          {
            executionGroups: [
              {
                activationBoundary: {
                  id: "round:1:phase1-resolution",
                  kind: "phase1_resolution",
                  roundNumber: 1,
                },
                blockerIds: [],
                completionState: "incomplete",
                diagnostics: [],
                executionStrategy: "initiative_groups",
                futureActivationBoundary: undefined,
                id: "attack-group",
                position: 0,
                stageId: "attack-stage",
                tasks: [canonicalTask],
              },
            ],
            executionStrategy: "initiative_groups",
            id: "attack-stage",
            kind: "attack",
            processId: "attack-process",
            state: "active",
            tasks: [canonicalTask],
          },
        ],
      },
    ],
    roundNumber: 1,
  },
  diagnostics: [],
  executionOrder: {
    currentInitiativeGroupId: canonicalTask.identity.initiativeGroupId,
    currentInitiativeValue: canonicalTask.identity.initiativeValue,
    participantIds: ["encounter-attacker", "encounter-defender"],
    phase: "phase1",
  },
  roundNumber: 1,
} satisfies CombatProgressionProjection;

const projectedTask = projectCombatProgressionPresentation({
  projection: canonicalProjection,
  viewer: {
    controlledParticipantIds: new Set(["encounter-attacker"]),
    kind: "player",
    visibleParticipantIds: new Set(["encounter-attacker", "encounter-defender"]),
  },
}).processes[0]?.stages[0]?.tasks[0];

if (!projectedTask) throw new Error("Expected the Player-safe attack task fixture to project.");

const validation = {
  actionId: "attack_parry",
  attackContextAvailability: "complete",
  attackerModifierFingerprint: "v1:attacker",
  attackerParticipantId: projectedTask.identity.attackerParticipantId!,
  defenderParticipantId: projectedTask.identity.defenderParticipantId!,
  effectCutoffInitiativeGroupId: projectedTask.identity.initiativeGroupId,
  encounterId: "encounter-1",
  expectedRevision: "revision-2",
  initiativeGroupId: projectedTask.identity.initiativeGroupId,
  initiativeValue: projectedTask.identity.initiativeValue,
  obSkillRaw: 3,
  opportunityId: projectedTask.identity.opportunityId,
  pairKey: "encounter-attacker::encounter-defender",
  phase: projectedTask.identity.phase!,
  taskId: projectedTask.id,
} satisfies CombatAttackModifierValidationProjection;

const contractInput = {
  attackerParticipantId: "encounter-attacker",
  defenderParticipantId: "encounter-defender",
  encounterId: "encounter-1",
  encounterRevision: "revision-2",
  phase: "phase1" as const,
  task: projectedTask,
  validation,
};

describe("Player-safe attack projection to request contract", () => {
  it("keeps availability and request construction coherent for the actual projected task", () => {
    expect(projectedTask.identity).toMatchObject({
      attackIndex: 1,
      initiativeGroupId: "round:1:phase:phase1:initiative:7",
      initiativeValue: 7,
      opportunityId: "attack-opportunity",
    });
    expect(
      projectPlayerCombatAttackContextAvailability({
        ...contractInput,
        attackSourceAvailable: true,
        historyRevision: "revision-2",
        refreshPending: false,
      }),
    ).toEqual({ status: "complete" });
    expect(buildPlayerCombatAttackModifierRequest(contractInput)).toEqual({
      effectCutoffInitiativeGroupId: "round:1:phase:phase1:initiative:7",
      expectedRevision: "revision-2",
      initiativeGroupId: "round:1:phase:phase1:initiative:7",
      initiativeValue: 7,
      modifierValidationTaskId: "attack-task",
    });
  });

  it.each([
    ["revision", { validation: { ...validation, expectedRevision: "revision-1" } }],
    ["task", { validation: { ...validation, taskId: "future-task" } }],
    ["attacker", { validation: { ...validation, attackerParticipantId: "foreign-attacker" } }],
    ["defender", { validation: { ...validation, defenderParticipantId: "foreign-defender" } }],
    ["opportunity", { validation: { ...validation, opportunityId: "future-opportunity" } }],
    [
      "projected opportunity",
      {
        task: {
          ...projectedTask,
          identity: { ...projectedTask.identity, opportunityId: undefined },
        },
      },
    ],
    ["initiative group", { validation: { ...validation, initiativeGroupId: undefined } }],
    [
      "projected initiative group",
      {
        task: {
          ...projectedTask,
          identity: { ...projectedTask.identity, initiativeGroupId: undefined },
        },
      },
    ],
    ["initiative value", { validation: { ...validation, initiativeValue: undefined } }],
    [
      "projected initiative value",
      {
        task: {
          ...projectedTask,
          identity: { ...projectedTask.identity, initiativeValue: undefined },
        },
      },
    ],
    ["effect cutoff", { validation: { ...validation, effectCutoffInitiativeGroupId: undefined } }],
  ])("fails closed at both consumers for missing or mismatched %s identity", (_label, override) => {
    const changed = { ...contractInput, ...override };
    expect(
      projectPlayerCombatAttackContextAvailability({
        ...changed,
        attackSourceAvailable: true,
        historyRevision: "revision-2",
        refreshPending: false,
      }),
    ).toMatchObject({ status: "stale" });
    expect(buildPlayerCombatAttackModifierRequest(changed)).toBeUndefined();
  });
});
