import { describe, expect, it } from "vitest";

import { buildCombatActionProcessPlans } from "./combatActionProcesses";
import { buildCombatProgressionProjection } from "./combatProgressionProjection";
import {
  combatMissileIncomingAttackSchema,
  combatRoundStateSchema,
  getCombatRoundOutgoingAttackResultForParticipantPhase,
  getCombatRoundPendingMissileIncomingAttack,
  getLatestCombatEventSummary,
  recordCombatRoundDeclaration,
  recordCombatRoundMissileShot,
  undoLatestCombatRoundCommand,
} from "./combatRoundManager";

const at = "2026-08-18T10:00:00.000Z";
const missileProfile = {
  ammoFamily: "arrow" as const,
  canRemainReady: false,
  family: "long_bow" as const,
  fullNormalCycleRounds: 2,
  preparationModel: "continuous_fragile" as const,
  rapidShotAllowed: true,
  standardPreparationRounds: 1,
};

function state() {
  return combatRoundStateSchema.parse({
    currentCursor: { participantId: "archer", roundNumber: 1, step: "A1" },
    currentStep: "phase_1_actions",
    encounterId: "encounter-1",
    missileReadiness: [
      {
        aimCompletedRounds: 0,
        aimLevel: 0,
        aimRequiredRounds: 0,
        ammoFamily: "arrow",
        ammoItemId: "arrows",
        ammoItemRevision: "ammo-revision-1",
        baseCompletedRounds: 1,
        baseRequiredRounds: 1,
        family: "long_bow",
        gmPreparationAdjustment: 0,
        id: "missile-readiness:archer:longbow",
        participantId: "archer",
        phase: "phase1",
        profile: missileProfile,
        rapidShot: false,
        status: "ready",
        targetParticipantId: "target",
        updatedAt: at,
        weaponItemId: "longbow",
        weaponTemplateId: "weapon-template-long-bow",
      },
    ],
    participants: [
      {
        declaration: {
          actionId: "attack_parry",
          attackOpportunities: [
            {
              actionId: "attack_parry",
              attackIndex: 1,
              attackModeId: "mode-1",
              attackType: "missile",
              declarationId: "declaration-1",
              id: "opportunity-1",
              itemId: "longbow",
              missileProfile,
              origin: "declared",
              phase: "phase1",
              slot: "attack_1",
              status: "committed",
              targetParticipantId: "target",
              weaponInstanceId: "longbow",
              weaponSourceId: "longbow",
              weaponSourceSlot: "throwing",
              weaponTemplateId: "weapon-template-long-bow",
            },
          ],
          id: "declaration-1",
          roundNumber: 1,
          submittedBy: "player",
        },
        initiatives: { phase1: { rolls: [6], total: 17 } },
        label: "Archer",
        participantId: "archer",
        stepStatuses: { phase_1_actions: "ready" },
      },
      {
        initiatives: { phase1: { rolls: [4], total: 4 } },
        label: "Target",
        participantId: "target",
      },
    ],
    phaseResolutionCursor: { participantId: "archer", phase: "phase1", substep: "attack" },
    phaseResolutionStatuses: { archer: { phase1: { substep: "attack" } } },
    roundNumber: 1,
  });
}

function attack() {
  return combatMissileIncomingAttackSchema.parse({
    actionId: "attack_parry",
    attackIndex: 1,
    attackModeId: "mode-1",
    attackOpportunityId: "opportunity-1",
    attackSlot: "attack_1",
    attackerParticipantId: "archer",
    declarationId: "declaration-1",
    defenderParticipantId: "target",
    id: "missile-incoming:round:1:opportunity-1",
    kind: "missileIncomingAttack",
    ob: 42,
    openEndedD10s: [],
    phase: "phase1",
    rollD20: 14,
    rollTotal: 14,
    rolledAt: at,
    status: "awaiting_defense",
    weaponArmorClass: "C",
    weaponDmbFormula: { diceCount: 3, diceSides: 6, kind: "dice", raw: "3d6+GMstr" },
    weaponDmbRaw: "3d6+GMstr",
    weaponInstanceId: "longbow",
    weaponModeInitiative: 3,
    weaponModeRange: "70/210/420",
    weaponModeSourceMetadata: {
      rawRow: { A: "Longbow" },
      row: 17,
      sheet: "Weapon2",
      sourceColumns: { A: "Weapon" },
      sourceRange: "A17:K17",
      workbook: "Themistogenes 1.07.xlsx",
    },
    weaponName: "Longbow",
    weaponSourceId: "longbow",
    weaponSourceSlot: "throwing",
    weaponTemplateId: "weapon-template-long-bow",
  });
}

describe("pending missile defense boundary", () => {
  it("preserves a compatible declaration but invalidates and exactly undoes a changed action", () => {
    const declarationState = combatRoundStateSchema.parse({
      ...state(),
      currentCursor: { participantId: "archer", roundNumber: 2, step: "M1" },
      currentStep: "review_action_modifiers",
      phaseResolutionCursor: undefined,
      phaseResolutionStatuses: {},
      selectedParticipantId: "archer",
      selectedStep: "review_action_modifiers",
      roundNumber: 2,
      missileReadiness: state().missileReadiness.map((readiness) => ({
        ...readiness,
        aimCompletedRounds: 2,
        aimLevel: 1,
        aimRequiredRounds: 2,
      })),
    });
    const compatible = recordCombatRoundDeclaration({
      command: { createdAt: "2026-08-18T10:01:00.000Z" },
      declaration: {
        actionId: "attack_parry",
        attackOpportunities: declarationState.participants[0]!.declaration!.attackOpportunities,
        id: "declaration-2",
        roundNumber: 2,
      },
      participantId: "archer",
      state: declarationState,
      submittedBy: "player",
    });
    expect(compatible.missileReadiness[0]?.status).toBe("ready");
    expect(compatible.missileReadiness[0]?.aimCompletedRounds).toBe(2);
    expect(compatible.commands.at(-1)?.facts.previousMissileReadiness).toEqual([]);

    const smallMovement = recordCombatRoundDeclaration({
      command: { createdAt: "2026-08-18T10:01:30.000Z" },
      declaration: {
        actionId: "attack_parry",
        attackOpportunities: declarationState.participants[0]!.declaration!.attackOpportunities,
        id: "declaration-small-movement",
        movementIntent: {
          distancePreferences: [],
          environmentalMovement: {
            destination: { description: "the next firing position", kind: "description" },
            duration: { kind: "phase", phase: "phase1" },
            pace: "reposition",
          },
          mode: "move_in_environment",
        },
        roundNumber: 2,
      },
      participantId: "archer",
      state: compatible,
      submittedBy: "player",
    });
    expect(smallMovement.missileReadiness[0]).toMatchObject({
      aimCompletedRounds: 2,
      baseCompletedRounds: 1,
      status: "ready",
    });
    expect(smallMovement.commands.at(-1)?.facts.previousMissileReadiness).toEqual([]);

    const majorMovement = recordCombatRoundDeclaration({
      command: { createdAt: "2026-08-18T10:01:45.000Z" },
      declaration: {
        actionId: "attack_parry",
        attackOpportunities: declarationState.participants[0]!.declaration!.attackOpportunities,
        id: "declaration-major-movement",
        movementIntent: {
          distancePreferences: [],
          environmentalMovement: {
            destination: { description: "the far ridge", kind: "description" },
            duration: { kind: "rounds", rounds: 2 },
            pace: "run",
          },
          mode: "move_in_environment",
        },
        roundNumber: 2,
      },
      participantId: "archer",
      state: smallMovement,
      submittedBy: "player",
    });
    expect(majorMovement.missileReadiness[0]).toMatchObject({
      aimCompletedRounds: 0,
      baseCompletedRounds: 0,
      status: "idle",
    });
    expect(majorMovement.commands.at(-1)?.facts.previousMissileReadiness).toHaveLength(1);
    const majorMovementUndone = undoLatestCombatRoundCommand({
      state: combatRoundStateSchema.parse(JSON.parse(JSON.stringify(majorMovement))),
    });
    expect(majorMovementUndone?.participants[0]?.declaration?.id).toBe(
      "declaration-small-movement",
    );
    expect(majorMovementUndone?.missileReadiness[0]).toMatchObject({
      aimCompletedRounds: 2,
      baseCompletedRounds: 1,
      status: "ready",
      targetParticipantId: "target",
    });

    const changed = recordCombatRoundDeclaration({
      command: { createdAt: "2026-08-18T10:02:00.000Z" },
      declaration: {
        actionId: "attack_parry",
        attackOpportunities: [
          {
            actionId: "attack_parry",
            attackIndex: 1,
            attackModeId: "mode-1",
            attackType: "melee",
            declarationId: "declaration-3",
            id: "melee-opportunity",
            itemId: "sword",
            origin: "declared",
            phase: "phase1",
            slot: "attack_1",
            status: "committed",
            targetParticipantId: "target",
            weaponInstanceId: "sword",
            weaponSourceId: "sword",
            weaponSourceSlot: "primary",
            weaponTemplateId: "weapon-template-sword",
          },
        ],
        id: "declaration-3",
        roundNumber: 2,
      },
      participantId: "archer",
      state: smallMovement,
      submittedBy: "player",
    });
    expect(changed.missileReadiness[0]).toMatchObject({ status: "idle" });
    expect(changed.commands.at(-1)?.facts.previousMissileReadiness).toHaveLength(1);
    const undone = undoLatestCombatRoundCommand({
      state: combatRoundStateSchema.parse(JSON.parse(JSON.stringify(changed))),
    });
    expect(undone?.participants[0]?.declaration?.id).toBe("declaration-small-movement");
    expect(undone?.missileReadiness[0]).toMatchObject({
      aimCompletedRounds: 2,
      baseCompletedRounds: 1,
      status: "ready",
      targetParticipantId: "target",
    });
  });

  it("invalidates fragile Sling work but retains a loaded crossbow stage through major movement", () => {
    const declarationState = combatRoundStateSchema.parse({
      ...state(),
      currentCursor: { participantId: "archer", roundNumber: 2, step: "M1" },
      currentStep: "review_action_modifiers",
      phaseResolutionCursor: undefined,
      phaseResolutionStatuses: {},
      roundNumber: 2,
      selectedParticipantId: "archer",
      selectedStep: "review_action_modifiers",
    });
    const runMovement = {
      distancePreferences: [],
      environmentalMovement: {
        destination: { description: "cover across the courtyard", kind: "description" as const },
        duration: { kind: "round" as const },
        pace: "run" as const,
      },
      mode: "move_in_environment" as const,
    };
    const exercise = (input: {
      opportunity: NonNullable<
        (typeof declarationState.participants)[number]["declaration"]
      >["attackOpportunities"];
      readiness: (typeof declarationState.missileReadiness)[number];
    }) => {
      const next = recordCombatRoundDeclaration({
        command: { createdAt: "2026-08-18T10:03:00.000Z" },
        declaration: {
          actionId: "attack_parry",
          attackOpportunities: input.opportunity,
          id: `declaration-${input.readiness.family}`,
          movementIntent: runMovement,
          roundNumber: 2,
        },
        participantId: "archer",
        state: combatRoundStateSchema.parse({
          ...declarationState,
          missileReadiness: [input.readiness],
          participants: declarationState.participants.map((participant) =>
            participant.participantId === "archer" && participant.declaration
              ? {
                  ...participant,
                  declaration: {
                    ...participant.declaration,
                    attackOpportunities: input.opportunity,
                  },
                }
              : participant,
          ),
        }),
        submittedBy: "player",
      });
      return {
        next,
        undone: undoLatestCombatRoundCommand({
          state: combatRoundStateSchema.parse(JSON.parse(JSON.stringify(next))),
        }),
      };
    };

    const slingProfile = {
      ammoFamily: "sling_projectile" as const,
      canRemainReady: false,
      family: "sling" as const,
      fullNormalCycleRounds: 2,
      preparationModel: "continuous_fragile" as const,
      rapidShotAllowed: true,
      standardPreparationRounds: 1,
    };
    const sling = exercise({
      opportunity: declarationState.participants[0]!.declaration!.attackOpportunities!.map(
        (opportunity) => ({
          ...opportunity,
          itemId: "sling",
          missileProfile: slingProfile,
          weaponInstanceId: "sling",
          weaponSourceId: "sling",
          weaponTemplateId: "weapon-template-sling",
        }),
      ),
      readiness: {
        ...declarationState.missileReadiness[0]!,
        aimCompletedRounds: 2,
        aimLevel: 1,
        aimRequiredRounds: 2,
        ammoFamily: "sling_projectile",
        ammoItemId: "stones",
        family: "sling",
        id: "missile-readiness:archer:sling",
        profile: slingProfile,
        weaponItemId: "sling",
        weaponTemplateId: "weapon-template-sling",
      },
    });
    expect(sling.next.missileReadiness[0]).toMatchObject({
      aimCompletedRounds: 0,
      baseCompletedRounds: 0,
      status: "idle",
    });
    expect(sling.undone?.missileReadiness[0]).toMatchObject({
      aimCompletedRounds: 2,
      baseCompletedRounds: 1,
      status: "ready",
    });

    const crossbowProfile = {
      ammoFamily: "crossbow_bolt" as const,
      canRemainReady: true,
      family: "crossbow" as const,
      fullNormalCycleRounds: 8,
      preparationModel: "staged_persistent" as const,
      rapidShotAllowed: false,
      standardPreparationRounds: 7,
    };
    const crossbow = exercise({
      opportunity: declarationState.participants[0]!.declaration!.attackOpportunities!.map(
        (opportunity) => ({
          ...opportunity,
          itemId: "crossbow",
          missileProfile: crossbowProfile,
          weaponInstanceId: "crossbow",
          weaponSourceId: "crossbow",
          weaponTemplateId: "weapon-template-crossbow",
        }),
      ),
      readiness: {
        ...declarationState.missileReadiness[0]!,
        aimCompletedRounds: 1,
        aimLevel: 1,
        aimRequiredRounds: 2,
        ammoFamily: "crossbow_bolt",
        ammoItemId: "bolts",
        baseCompletedRounds: 7,
        baseRequiredRounds: 7,
        family: "crossbow",
        id: "missile-readiness:archer:crossbow",
        profile: crossbowProfile,
        status: "loaded",
        weaponItemId: "crossbow",
        weaponTemplateId: "weapon-template-crossbow",
      },
    });
    expect(crossbow.next.missileReadiness[0]).toMatchObject({
      aimCompletedRounds: 0,
      aimLevel: 0,
      baseCompletedRounds: 7,
      status: "loaded",
      targetParticipantId: undefined,
    });
    expect(crossbow.undone?.missileReadiness[0]).toMatchObject({
      aimCompletedRounds: 1,
      aimLevel: 1,
      baseCompletedRounds: 7,
      status: "loaded",
      targetParticipantId: "target",
    });
  });

  it("commits offense and consumption without choosing DB, hit, Parry, or damage", () => {
    const next = recordCombatRoundMissileShot({
      attack: attack(),
      command: { createdAt: at, createdByUserId: "player-1" },
      participantId: "archer",
      state: state(),
      submittedBy: "player",
    });
    const command = next.commands.at(-1)!;
    expect(command.type).toBe("roll_attack");
    expect(command.facts).not.toHaveProperty("defenderCalculation");
    expect(command.facts).not.toHaveProperty("defenderDb");
    expect(command.facts).not.toHaveProperty("hit");
    expect(command.facts).not.toHaveProperty("weaponDmbRoll");
    expect(
      getCombatRoundOutgoingAttackResultForParticipantPhase({
        participantId: "archer",
        phase: "phase1",
        state: next,
      }),
    ).toBeUndefined();
    expect(next.phaseResolutionResults).toEqual([]);
    expect(next.missileReadiness[0]).toMatchObject({
      baseCompletedRounds: 0,
      gmPreparationAdjustment: 0,
      status: "idle",
    });
    expect(
      getCombatRoundPendingMissileIncomingAttack({
        opportunityId: "opportunity-1",
        state: next,
      }),
    ).toMatchObject({
      ob: 42,
      status: "awaiting_defense",
      weaponModeRange: "70/210/420",
    });
    expect(next.events.at(-1)).toMatchObject({ status: "proposed", type: "attack" });
    expect(
      getLatestCombatEventSummary(next, [
        { label: "Archer", participantId: "archer" },
        { label: "Target", participantId: "target" },
      ]),
    ).toMatchObject({
      details: "Range 70/210/420 · Weapon2 row 17",
      shortTitle: "Missile shot committed",
      summaryText: "Round 1, Phase 1: Archer fired at Target; awaiting defense review.",
    });

    const process = buildCombatActionProcessPlans(next)[0]?.standardAttacks[0];
    expect(process).toMatchObject({
      attackResultId: "1:opportunity:opportunity-1",
    });
    expect(process?.stages.find((stage) => stage.kind === "attack")?.state).toBe("complete");
    expect(process?.stages.find((stage) => stage.kind === "defense")?.state).toBe("ready");
    const tasks = buildCombatProgressionProjection(next).boundary.processes.flatMap((entry) =>
      entry.stages.flatMap((stage) => stage.tasks),
    );
    expect(next.currentCursor).toMatchObject({ participantId: "target", step: "P1" });
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      expectedCommand: "commit_defense_review",
      identity: {
        attackResultId: "1:opportunity:opportunity-1",
        attackerParticipantId: "archer",
        defenderParticipantId: "target",
        opportunityId: "opportunity-1",
        phase: "phase1",
      },
      kind: "defense_review",
      state: "executable",
      trackerFacet: { owner: { participantId: "target" }, step: "P1" },
    });
  });

  it("restores the exact ready shot on undo and remains deterministic after reload", () => {
    const fired = recordCombatRoundMissileShot({
      attack: attack(),
      command: { commandId: "shot-1", createdAt: at },
      participantId: "archer",
      state: state(),
      submittedBy: "gm",
    });
    const reloaded = combatRoundStateSchema.parse(JSON.parse(JSON.stringify(fired)));
    const undone = undoLatestCombatRoundCommand({ state: reloaded });
    expect(undone?.commands).toHaveLength(0);
    expect(undone?.events).toHaveLength(0);
    expect(undone?.missileReadiness[0]).toMatchObject({
      ammoItemId: "arrows",
      ammoItemRevision: "ammo-revision-1",
      baseCompletedRounds: 1,
      status: "ready",
      targetParticipantId: "target",
    });
  });
});
