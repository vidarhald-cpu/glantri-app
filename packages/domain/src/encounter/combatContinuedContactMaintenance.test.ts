import { describe, expect, it } from "vitest";

import {
  buildContinuedContactMaintenanceContestId,
  buildContinuedContactMaintenanceContestResultId,
  buildUnbalancedConditionId,
  type OffensiveParryBrawlingRoll,
} from "./combatOffensiveParry";
import {
  combatRoundStateSchema,
  prepareCombatRoundEndReview,
  recordContinuedContactMaintenanceRoll,
  undoLatestCombatRoundCommand,
  type CombatRoundState,
} from "./combatRoundManager";
import {
  authorizeCombatProgressionTask,
  buildCombatProgressionProjection,
} from "./combatProgressionProjection";

const CONTACT_ID = "contact:offensive-parry";
const CONDITION_ID = buildUnbalancedConditionId({ continuedContactId: CONTACT_ID });

function state(roundNumber = 3): CombatRoundState {
  return combatRoundStateSchema.parse({
    continuedContacts: [
      {
        affectedParticipantId: "guard",
        brawlingContestResultId: "opening-contest:result",
        controllerParticipantId: "hero",
        establishedPhase: "phase1",
        establishedRound: 2,
        id: CONTACT_ID,
        sourceActionId: "offensive_parry",
        sourceAttackResultId: "attack:2",
        sourceDeclarationId: "declaration:2:hero",
        sourceOpportunityId: "opportunity:2",
        sourceParryResultId: "parry:2",
        status: "active",
      },
    ],
    currentCursor: { participantId: "hero", roundNumber, step: "SU" },
    currentStep: "round_summary",
    distanceState: {
      edges: {
        "guard::hero": {
          distance: 2,
          pairKey: "guard::hero",
          participantAId: "guard",
          participantBId: "hero",
          source: "round_end_review",
        },
      },
    },
    participants: [
      {
        declaration: {
          actionId: "attack_parry",
          movementIntent: {
            distancePreferences: [
              {
                desiredDistance: 1,
                source: "player_declared",
                targetParticipantId: "guard",
              },
            ],
            mode: "set_distance_preferences",
          },
          roundNumber,
          submittedBy: "player",
        },
        label: "Hero",
        participantId: "hero",
        scenarioParticipantId: "scenario-hero",
      },
      {
        declaration: {
          actionId: "attack_parry",
          movementIntent: {
            distancePreferences: [
              {
                desiredDistance: 3,
                source: "player_declared",
                targetParticipantId: "hero",
              },
            ],
            mode: "set_distance_preferences",
          },
          roundNumber,
          submittedBy: "player",
        },
        label: "Guard",
        participantId: "guard",
        scenarioParticipantId: "scenario-guard",
      },
    ],
    roundNumber,
    unbalancedConditions: [
      {
        affectedParticipantId: "guard",
        establishedRound: 2,
        id: CONDITION_ID,
        modifierValue: -2,
        sourceActionId: "offensive_parry",
        sourceContinuedContactId: CONTACT_ID,
        status: "active",
      },
    ],
  });
}

function roll(participantId: string, total: number): OffensiveParryBrawlingRoll {
  return {
    brawlingBaseValue: 10,
    brawlingSkillXp: 10,
    characteristicAverage: 0,
    finalTotal: total,
    generalModifier: 0,
    id: `maintenance:roll:${participantId}`,
    openEndedD10s: [],
    participantId,
    parryQualityModifier: 0,
    pendingModifiers: [],
    rollD20: 10,
    rollPurpose: "escape_continued_contact",
    rollTotal: total - 10,
    rolledAt: "2026-07-25T10:00:00.000Z",
    skillId: "brawling",
    skillLabel: "Brawling",
    skillModifier: 0,
  };
}

function prepared(): CombatRoundState {
  return prepareCombatRoundEndReview({
    command: { createdAt: "2026-07-25T09:00:00.000Z" },
    state: state(),
  });
}

function maintenanceTask(source: CombatRoundState, participantId: string) {
  return buildCombatProgressionProjection(source)
    .boundary.processes.flatMap((process) => process.stages)
    .flatMap((stage) => stage.tasks)
    .find(
      (task) =>
        task.kind === "continued_contact_maintenance_roll" &&
        task.owner?.kind === "combatant" &&
        task.owner.participantId === participantId,
    );
}

describe("Continued Contact maintenance", () => {
  it("waits one complete round, then projects both participant-owned Brawling rolls first", () => {
    const establishmentRound = prepareCombatRoundEndReview({
      command: { createdAt: "2026-07-25T09:00:00.000Z" },
      state: state(2),
    });
    expect(establishmentRound.roundEndReview?.continuedContactMaintenanceContests).toEqual([]);
    expect(establishmentRound.roundEndReview?.proposedDistances[0]).toMatchObject({
      controlMode: "continued_contact",
      controllerParticipantId: "hero",
    });

    const source = prepared();
    const contestId = buildContinuedContactMaintenanceContestId({
      continuedContactId: CONTACT_ID,
      roundNumber: 3,
    });
    expect(source.roundEndReview?.continuedContactMaintenanceContests).toEqual([
      expect.objectContaining({
        id: contestId,
        resultId: buildContinuedContactMaintenanceContestResultId({ contestId }),
        status: "awaiting_rolls",
      }),
    ]);
    expect(source.roundEndReview?.proposedDistances).toEqual([]);
    const heroTask = maintenanceTask(source, "hero");
    const guardTask = maintenanceTask(source, "guard");
    expect(heroTask?.executionGroupId).toBe(guardTask?.executionGroupId);
    expect(heroTask?.trackerFacet.step).toBe("SU");
    expect(
      authorizeCombatProgressionTask({
        actor: { kind: "combatant", participantId: "hero" },
        commandType: "roll_continued_contact_maintenance",
        contestId,
        continuedContactId: CONTACT_ID,
        executionGroupId: heroTask?.executionGroupId,
        opponentParticipantId: "guard",
        participantId: "hero",
        processId: heroTask?.processId,
        projection: buildCombatProgressionProjection(source),
        rollPurpose: "escape_continued_contact",
        stageId: heroTask?.stageId,
        taskId: heroTask?.id,
      }),
    ).toMatchObject({ ok: true, task: { id: heroTask?.id } });
  });

  it("keeps contact on a strict controller win and restores one unresolved roll on undo", () => {
    const source = prepared();
    const heroTask = maintenanceTask(source, "hero")!;
    const first = recordContinuedContactMaintenanceRoll({
      command: { createdAt: "2026-07-25T10:00:00.000Z" },
      contestId: heroTask.identity.contestId!,
      executionGroupId: heroTask.executionGroupId,
      opponentParticipantId: "guard",
      participantId: "hero",
      roll: roll("hero", 24),
      state: source,
    }).state;
    expect(maintenanceTask(first, "hero")).toBeUndefined();
    const guardTask = maintenanceTask(first, "guard")!;
    expect(guardTask.executionGroupId).toBe(heroTask.executionGroupId);

    const final = recordContinuedContactMaintenanceRoll({
      command: { createdAt: "2026-07-25T10:01:00.000Z" },
      contestId: guardTask.identity.contestId!,
      executionGroupId: guardTask.executionGroupId,
      opponentParticipantId: "hero",
      participantId: "guard",
      roll: roll("guard", 20),
      state: first,
    }).state;
    expect(maintenanceTask(final, "hero")).toBeUndefined();
    expect(maintenanceTask(final, "guard")).toBeUndefined();
    expect(final.continuedContacts[0]).toMatchObject({
      lastMaintainedRound: 3,
      status: "active",
    });
    expect(final.unbalancedConditions[0]?.status).toBe("active");
    expect(final.roundEndReview?.proposedDistances[0]).toMatchObject({
      controlMode: "continued_contact",
      controllerParticipantId: "hero",
    });

    const reloaded = combatRoundStateSchema.parse(JSON.parse(JSON.stringify(final)));
    expect(maintenanceTask(reloaded, "hero")).toBeUndefined();
    expect(maintenanceTask(reloaded, "guard")).toBeUndefined();
    expect(reloaded.continuedContacts[0]).toMatchObject({
      lastMaintainedRound: 3,
      status: "active",
    });

    const undone = undoLatestCombatRoundCommand({ state: reloaded });
    expect(undone?.continuedContacts[0]).toMatchObject({ status: "active" });
    expect(undone?.roundEndReview?.proposedDistances).toEqual([]);
    expect(maintenanceTask(undone!, "guard")).toBeDefined();
    expect(maintenanceTask(undone!, "hero")).toBeUndefined();
  });

  it.each([
    ["defender win", 20, 24, "escaped"],
    ["tie", 20, 20, "tie"],
  ] as const)(
    "ends contact, removes Unbalanced, and restores ordinary distance control on %s",
    (_label, controllerTotal, affectedTotal, outcome) => {
      const source = prepared();
      const heroTask = maintenanceTask(source, "hero")!;
      const first = recordContinuedContactMaintenanceRoll({
        command: { createdAt: "2026-07-25T10:00:00.000Z" },
        contestId: heroTask.identity.contestId!,
        executionGroupId: heroTask.executionGroupId,
        opponentParticipantId: "guard",
        participantId: "hero",
        roll: roll("hero", controllerTotal),
        state: source,
      }).state;
      const guardTask = maintenanceTask(first, "guard")!;
      const final = recordContinuedContactMaintenanceRoll({
        command: { createdAt: "2026-07-25T10:01:00.000Z" },
        contestId: guardTask.identity.contestId!,
        executionGroupId: guardTask.executionGroupId,
        opponentParticipantId: "hero",
        participantId: "guard",
        roll: roll("guard", affectedTotal),
        state: first,
      }).state;

      expect(final.roundEndReview?.continuedContactMaintenanceContests[0]).toMatchObject({
        outcome,
        status: "resolved",
      });
      expect(final.continuedContacts[0]?.status).toBe("ended");
      expect(final.unbalancedConditions[0]?.status).toBe("ended");
      expect(final.roundEndReview?.proposedDistances[0]).toMatchObject({
        controlMode: "ordinary",
        requiresContest: true,
      });
    },
  );

  it("projects independent maintenance contests for unrelated Continued Contact pairs", () => {
    const source = state();
    const secondContactId = "contact:offensive-parry:second";
    const secondConditionId = buildUnbalancedConditionId({
      continuedContactId: secondContactId,
    });
    const expanded = combatRoundStateSchema.parse({
      ...source,
      continuedContacts: [
        ...source.continuedContacts,
        {
          affectedParticipantId: "raider",
          brawlingContestResultId: "opening-contest:result:second",
          controllerParticipantId: "mage",
          establishedPhase: "phase2",
          establishedRound: 2,
          id: secondContactId,
          sourceActionId: "offensive_parry",
          sourceAttackResultId: "attack:second",
          sourceDeclarationId: "declaration:second",
          sourceOpportunityId: "opportunity:second",
          sourceParryResultId: "parry:second",
          status: "active",
        },
      ],
      participants: [
        ...source.participants,
        {
          declaration: {
            actionId: "attack_parry",
            movementIntent: {
              distancePreferences: [
                {
                  desiredDistance: 1,
                  source: "player_declared",
                  targetParticipantId: "raider",
                },
              ],
              mode: "set_distance_preferences",
            },
            roundNumber: 3,
            submittedBy: "player",
          },
          label: "Mage",
          participantId: "mage",
          scenarioParticipantId: "scenario-mage",
        },
        {
          declaration: {
            actionId: "attack_parry",
            movementIntent: {
              distancePreferences: [
                {
                  desiredDistance: 4,
                  source: "player_declared",
                  targetParticipantId: "mage",
                },
              ],
              mode: "set_distance_preferences",
            },
            roundNumber: 3,
            submittedBy: "player",
          },
          label: "Raider",
          participantId: "raider",
          scenarioParticipantId: "scenario-raider",
        },
      ],
      unbalancedConditions: [
        ...source.unbalancedConditions,
        {
          affectedParticipantId: "raider",
          establishedRound: 2,
          id: secondConditionId,
          modifierValue: -2,
          sourceActionId: "offensive_parry",
          sourceContinuedContactId: secondContactId,
          status: "active",
        },
      ],
    });
    const reviewed = prepareCombatRoundEndReview({ state: expanded });
    expect(
      reviewed.roundEndReview?.continuedContactMaintenanceContests.map((contest) => ({
        affected: contest.affectedParticipantId,
        contact: contest.continuedContactId,
        controller: contest.controllerParticipantId,
      })),
    ).toEqual([
      { affected: "guard", contact: CONTACT_ID, controller: "hero" },
      { affected: "raider", contact: secondContactId, controller: "mage" },
    ]);
    const tasks = buildCombatProgressionProjection(reviewed)
      .boundary.processes.flatMap((process) => process.stages)
      .flatMap((stage) => stage.tasks)
      .filter((task) => task.kind === "continued_contact_maintenance_roll");
    expect(
      tasks.map((task) => task.owner?.kind === "combatant" && task.owner.participantId),
    ).toEqual(["hero", "guard", "mage", "raider"]);
    expect(new Set(tasks.map((task) => task.identity.contestId)).size).toBe(2);
    expect(reviewed.roundEndReview?.proposedDistances).toEqual([]);

    const reloadedInReverseStorageOrder = prepareCombatRoundEndReview({
      state: combatRoundStateSchema.parse({
        ...expanded,
        continuedContacts: [...expanded.continuedContacts].reverse(),
      }),
    });
    expect(
      reloadedInReverseStorageOrder.roundEndReview?.continuedContactMaintenanceContests.map(
        (contest) => contest.continuedContactId,
      ),
    ).toEqual([CONTACT_ID, secondContactId]);
  });

  it("blocks reversed controllers for one pair before either maintenance roll", () => {
    const source = state();
    const reversedContactId = "contact:offensive-parry:reversed";
    const reversedConditionId = buildUnbalancedConditionId({
      continuedContactId: reversedContactId,
    });
    const reviewed = prepareCombatRoundEndReview({
      state: combatRoundStateSchema.parse({
        ...source,
        continuedContacts: [
          ...source.continuedContacts,
          {
            ...source.continuedContacts[0],
            affectedParticipantId: "hero",
            controllerParticipantId: "guard",
            id: reversedContactId,
          },
        ],
        unbalancedConditions: [
          ...source.unbalancedConditions,
          {
            ...source.unbalancedConditions[0],
            affectedParticipantId: "hero",
            id: reversedConditionId,
            sourceContinuedContactId: reversedContactId,
          },
        ],
      }),
    });
    expect(
      reviewed.roundEndReview?.continuedContactMaintenanceContests.map(
        (contest) => contest.reviewRequiredReason,
      ),
    ).toEqual(["conflicting_controllers", "conflicting_controllers"]);
    const current = maintenanceTask(reviewed, "hero")!;
    expect(current.allowedActors).toEqual([]);
    expect(current.presentationContext?.reason).toBe("Continued Contact requires GM review.");
    expect(() =>
      recordContinuedContactMaintenanceRoll({
        command: { createdAt: "2026-07-25T10:00:00.000Z" },
        contestId: current.identity.contestId!,
        executionGroupId: current.executionGroupId,
        opponentParticipantId: current.identity.opponentParticipantId!,
        participantId: "hero",
        roll: roll("hero", 20),
        state: reviewed,
      }),
    ).toThrow("Continued Contact requires GM review");
  });
});
