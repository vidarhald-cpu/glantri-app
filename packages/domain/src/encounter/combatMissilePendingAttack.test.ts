import { describe, expect, it } from "vitest";

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
    expect(compatible.commands.at(-1)?.facts.previousMissileReadiness).toEqual([]);

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
      state: compatible,
      submittedBy: "player",
    });
    expect(changed.missileReadiness[0]).toMatchObject({ status: "idle" });
    expect(changed.commands.at(-1)?.facts.previousMissileReadiness).toHaveLength(1);
    const undone = undoLatestCombatRoundCommand({
      state: combatRoundStateSchema.parse(JSON.parse(JSON.stringify(changed))),
    });
    expect(undone?.participants[0]?.declaration?.id).toBe("declaration-2");
    expect(undone?.missileReadiness[0]).toMatchObject({
      baseCompletedRounds: 1,
      status: "ready",
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
