import { describe, expect, it } from "vitest";

import {
  applyCombatActionGeneratedModifiers,
  buildOffensiveParryGeneratedDbModifier,
} from "./combatActionModifiers";
import {
  buildContinuedContactId,
  buildOffensiveParryContestId,
  buildUnbalancedConditionId,
  isUnbalancedModifierExcluded,
  resolveOffensiveParryContestWinner,
  resolveOffensiveParryQualityModifier,
} from "./combatOffensiveParry";
import {
  doesCombatModifierContributionApply,
  normalizeScenarioCombatModifierEntry,
  resolveCombatModifierContributions,
} from "./combatModifierContributions";
import {
  authorizeCombatProgressionTask,
  buildCombatProgressionProjection,
} from "./combatProgressionProjection";
import {
  combatRoundAttackRollResultSchema,
  combatRoundParryResolutionSchema,
  combatRoundStateSchema,
  recordCombatRoundOffensiveParryBrawlingRoll,
  recordCombatRoundParryResult,
  type CombatRoundState,
  undoLatestCombatRoundCommand,
} from "./combatRoundManager";

const at = "2026-07-23T10:00:00.000Z";

function state(): CombatRoundState {
  return combatRoundStateSchema.parse({
    currentCursor: { participantId: "attacker", roundNumber: 1, step: "P1" },
    currentStep: "phase_1_actions",
    encounterId: "encounter",
    participants: [
      {
        attackResults: { phase1: attack },
        declaration: {
          actionId: "attack_parry",
          attackOpportunities: [
            {
              id: "opportunity:1",
              origin: "declared",
              phase: "phase1",
              slot: "attack_1",
              status: "committed",
              targetParticipantId: "defender",
            },
          ],
          id: "declaration:attacker",
          phaseContexts: { phase1: { targetParticipantId: "defender" } },
          roundNumber: 1,
          submittedBy: "player",
        },
        label: "Attacker",
        participantId: "attacker",
        stepStatuses: {},
      },
      {
        attackResults: {},
        declaration: {
          actionId: "offensive_parry",
          id: "declaration:defender",
          phaseContexts: { phase1: { targetParticipantId: "attacker" } },
          roundNumber: 1,
          submittedBy: "player",
        },
        label: "Defender",
        participantId: "defender",
        stepStatuses: {},
      },
    ],
    phaseResolutionCursor: {
      participantId: "attacker",
      phase: "phase1",
      substep: "parry",
    },
    roundNumber: 1,
  });
}

const attack = combatRoundAttackRollResultSchema.parse({
  actionId: "attack_parry",
  attackOpportunityId: "opportunity:1",
  attackerParticipantId: "attacker",
  defenderDb: 10,
  defenderParticipantId: "defender",
  grazing: false,
  hit: true,
  kind: "attackRoll",
  lookupTotal: 40,
  marginOverMissThreshold: 20,
  ob: 10,
  openEndedD10s: [],
  phase: "phase1",
  rollD20: 20,
  rollTotal: 20,
  rolledAt: at,
  tableResult: "Hit",
  weaponName: "Sword",
});

const successfulParry = combatRoundParryResolutionSchema.parse({
  openEndedD10s: [],
  resultLabel: "Parry succeeded",
  rollD20: 16,
  rollTotal: 16,
  status: "resolved",
  success: true,
  targetNumber: 21,
  total: 31,
});

function roll(participantId: string, finalTotal: number) {
  return {
    brawlingBaseValue: 8,
    brawlingSkillXp: 12,
    characteristicAverage: 11,
    finalTotal,
    generalModifier: 0,
    id: `roll:${participantId}`,
    openEndedD10s: [],
    participantId,
    parryQualityModifier: participantId === "defender" ? 1 : 0,
    rollD20: 12,
    rollPurpose: "offensive_parry_brawling" as const,
    rollTotal: 12,
    rolledAt: at,
    skillId: "brawling" as const,
    skillLabel: "Brawling" as const,
    skillModifier: 0,
  };
}

function openContest(): CombatRoundState {
  return recordCombatRoundParryResult({
    attackResult: attack,
    command: { commandId: "parry-command", createdAt: at },
    parryResolution: successfulParry,
    state: state(),
    submittedBy: "player",
    updatedAt: at,
  });
}

describe("Offensive Parry rules", () => {
  it("uses the verified parry-quality table and treats a tie as no winner", () => {
    expect(resolveOffensiveParryQualityModifier(0)).toEqual({
      modifier: 0,
      tableRow: "0_to_5",
    });
    expect(resolveOffensiveParryQualityModifier(6)).toEqual({
      modifier: 1,
      tableRow: "6_to_10",
    });
    expect(resolveOffensiveParryQualityModifier(11)).toEqual({
      modifier: 2,
      tableRow: "11_to_15",
    });
    expect(resolveOffensiveParryQualityModifier(16)).toEqual({
      modifier: 4,
      tableRow: "16_plus",
    });
    expect(
      resolveOffensiveParryContestWinner({
        controllerParticipantId: "defender",
        controllerTotal: 20,
        responderParticipantId: "attacker",
        responderTotal: 20,
      }),
    ).toBeUndefined();
  });

  it("applies one round-bound flat DB drawback without changing percentage semantics", () => {
    const modifier = buildOffensiveParryGeneratedDbModifier({ roundNumber: 3 });
    expect(modifier).toMatchObject({
      application: "flat_db",
      expiresAtRound: 3,
      sourceActionId: "offensive_parry",
      value: -2,
    });
    const base = {
      modifierBuckets: {
        general: [],
        situationDb: [],
        situationInitiative: [],
        situationObSkill: [],
      },
    };
    const first = applyCombatActionGeneratedModifiers({
      actionId: "offensive_parry",
      combatContext: base,
      sourceRoundNumber: 3,
    });
    const recommitted = applyCombatActionGeneratedModifiers({
      actionId: "offensive_parry",
      combatContext: first,
      sourceRoundNumber: 3,
    });
    expect(recommitted.modifierBuckets.situationDb).toEqual(
      first.modifierBuckets.situationDb,
    );
    expect(recommitted.modifierBuckets.situationDb).toHaveLength(1);
  });

  it("opens only the exact successful-parry contest with canonical lineage", () => {
    const opened = openContest();
    const contest = opened.offensiveParryContests[0];
    expect(contest).toMatchObject({
      affectedParticipantId: "attacker",
      controllerParticipantId: "defender",
      declarationId: "declaration:defender",
      opportunityId: "opportunity:1",
      parryQualityModifier: 1,
      parryQualityTableRow: "6_to_10",
      phase: "phase1",
      status: "awaiting_rolls",
    });
    expect(contest?.id).toBe(
      buildOffensiveParryContestId({ parryResultId: contest!.parryResultId }),
    );

    const failed = recordCombatRoundParryResult({
      attackResult: attack,
      parryResolution: {
        openEndedD10s: [],
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 20,
      },
      state: state(),
      submittedBy: "player",
      updatedAt: at,
    });
    expect(failed.offensiveParryContests).toEqual([]);

    const sourceParryUndone = undoLatestCombatRoundCommand({ state: opened });
    expect(sourceParryUndone?.offensiveParryContests).toEqual([]);
  });

  it("persists independent rolls and establishes deterministic contact and Unbalanced", () => {
    const opened = openContest();
    const contest = opened.offensiveParryContests[0]!;
    const openGroup = buildCombatProgressionProjection(opened).boundary.processes
      .flatMap((process) => process.stages)
      .flatMap((stage) => stage.executionGroups)
      .find((group) =>
        group.tasks.some((task) => task.kind === "offensive_parry_brawling_roll"),
      );
    expect(openGroup).toMatchObject({
      executionStrategy: "parallel_all",
      tasks: [
        expect.objectContaining({
          kind: "offensive_parry_brawling_roll",
          owner: expect.objectContaining({ participantId: "defender" }),
          trackerFacet: {
            owner: expect.objectContaining({ participantId: "defender" }),
            step: "P1",
          },
        }),
        expect.objectContaining({
          kind: "offensive_parry_brawling_roll",
          owner: expect.objectContaining({ participantId: "attacker" }),
          trackerFacet: {
            owner: expect.objectContaining({ participantId: "attacker" }),
            step: "P1",
          },
        }),
      ],
    });
    const controllerTask = openGroup!.tasks.find(
      (task) => task.owner?.kind === "combatant" && task.owner.participantId === "defender",
    )!;
    const authorizationInput = {
      actor: { kind: "combatant" as const, participantId: "defender" },
      attackResultId: contest.attackResultId,
      commandType: "roll_offensive_parry_brawling" as const,
      contestId: contest.id,
      declarationId: contest.declarationId,
      executionGroupId: controllerTask.executionGroupId,
      opponentParticipantId: "attacker",
      opportunityId: contest.opportunityId,
      parryResultId: contest.parryResultId,
      participantId: "defender",
      phase: contest.phase,
      processId: controllerTask.processId,
      projection: buildCombatProgressionProjection(opened),
      stageId: controllerTask.stageId,
      taskId: controllerTask.id,
    };
    expect(authorizeCombatProgressionTask(authorizationInput)).toMatchObject({ ok: true });
    expect(
      authorizeCombatProgressionTask({
        ...authorizationInput,
        executionGroupId: "stale-group",
      }),
    ).toMatchObject({ code: "execution_group_mismatch", ok: false });
    expect(
      authorizeCombatProgressionTask({
        ...authorizationInput,
        opportunityId: "wrong-opportunity",
      }),
    ).toMatchObject({ code: "stale_opportunity", ok: false });
    expect(
      authorizeCombatProgressionTask({
        ...authorizationInput,
        actor: { kind: "combatant", participantId: "attacker" },
      }),
    ).toMatchObject({ code: "wrong_participant", ok: false });
    const afterController = recordCombatRoundOffensiveParryBrawlingRoll({
      attackResultId: contest.attackResultId,
      command: { commandId: "controller-roll-command", createdAt: at },
      contestId: contest.id,
      declarationId: contest.declarationId,
      executionGroupId: "group",
      opportunityId: contest.opportunityId,
      opponentParticipantId: "attacker",
      parryResultId: contest.parryResultId,
      phase: contest.phase,
      roll: roll("defender", 30),
      rollerParticipantId: "defender",
      state: opened,
      submittedBy: "player",
    });
    expect(afterController.offensiveParryContests[0]).toMatchObject({
      initiatorRollRecorded: true,
      responderRollRecorded: false,
      status: "awaiting_rolls",
    });
    const remainingTasks = buildCombatProgressionProjection(afterController).boundary.processes
      .flatMap((process) => process.stages)
      .flatMap((stage) => stage.executionGroups)
      .flatMap((group) => group.tasks)
      .filter((task) => task.kind === "offensive_parry_brawling_roll");
    expect(remainingTasks).toEqual([
      expect.objectContaining({
        owner: expect.objectContaining({ participantId: "attacker" }),
        trackerFacet: {
          owner: expect.objectContaining({ participantId: "attacker" }),
          step: "P1",
        },
      }),
    ]);

    const resolved = recordCombatRoundOffensiveParryBrawlingRoll({
      attackResultId: contest.attackResultId,
      command: { commandId: "responder-roll-command", createdAt: at },
      contestId: contest.id,
      declarationId: contest.declarationId,
      executionGroupId: "group",
      opportunityId: contest.opportunityId,
      opponentParticipantId: "defender",
      parryResultId: contest.parryResultId,
      phase: contest.phase,
      roll: roll("attacker", 20),
      rollerParticipantId: "attacker",
      state: afterController,
      submittedBy: "player",
    });
    const contactId = buildContinuedContactId({ contestId: contest.id });
    expect(resolved.offensiveParryContests[0]).toMatchObject({
      responderRollRecorded: true,
      status: "resolved",
      winnerParticipantId: "defender",
    });
    expect(resolved.continuedContacts).toEqual([
      expect.objectContaining({
        affectedParticipantId: "attacker",
        controllerParticipantId: "defender",
        id: contactId,
      }),
    ]);
    expect(resolved.unbalancedConditions).toEqual([
      expect.objectContaining({
        affectedParticipantId: "attacker",
        id: buildUnbalancedConditionId({ continuedContactId: contactId }),
        modifierValue: -2,
      }),
    ]);
    const undone = undoLatestCombatRoundCommand({ state: resolved });
    expect(undone).toBeDefined();
    expect(undone?.continuedContacts).toEqual([]);
    expect(undone?.unbalancedConditions).toEqual([]);
    expect(undone?.offensiveParryContests[0]).toMatchObject({
      initiatorRollRecorded: true,
      responderRollRecorded: false,
      status: "awaiting_rolls",
    });
  });

  it("excludes only the affected participant's future escape-purpose roll", () => {
    const contribution = normalizeScenarioCombatModifierEntry({
      bucket: "general",
      entry: {
        combatWide: true,
        excludedRollPurposes: ["escape_continued_contact"],
        id: "unbalanced",
        scope: "until",
        sourceEffectId: "unbalanced",
        value: -2,
      },
      ownerParticipantId: "attacker",
    });
    expect(contribution).toBeDefined();
    expect(contribution?.applicability.combatWide).toBe(true);
    expect(
      doesCombatModifierContributionApply(contribution!, {
        ownerParticipantId: "attacker",
        rollPurpose: "offensive_parry_brawling",
      }),
    ).toBe(true);
    expect(
      doesCombatModifierContributionApply(contribution!, {
        ownerParticipantId: "attacker",
        rollPurpose: "escape_continued_contact",
      }),
    ).toBe(false);
    expect(
      isUnbalancedModifierExcluded({
        affectedParticipantId: "attacker",
        ownerParticipantId: "attacker",
        rollPurpose: "escape_continued_contact",
      }),
    ).toBe(true);
    const ordinaryModifier = normalizeScenarioCombatModifierEntry({
      bucket: "general",
      entry: {
        id: "ordinary",
        scope: "until",
        value: 3,
      },
      ownerParticipantId: "attacker",
    })!;
    expect(
      resolveCombatModifierContributions({
        bucket: "general_fatigue",
        context: {
          ownerParticipantId: "attacker",
          rollPurpose: "escape_continued_contact",
        },
        contributions: [contribution!, ordinaryModifier],
      }),
    ).toMatchObject({
      rows: [expect.objectContaining({ id: "ordinary" })],
      total: 3,
    });
  });
});
