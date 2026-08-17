import { describe, expect, it } from "vitest";

import {
  advanceCombatMissileReadiness,
  consumeCombatMissileReadinessAfterShot,
  getCombatMissileAttackModifier,
  getCombatMissileRequiredRounds,
  interruptCombatMissileReadiness,
  isCombatMissileReady,
} from "./combatMissile";

const bow = {
  ammoFamily: "arrow" as const,
  canRemainReady: false,
  family: "long_bow" as const,
  fullNormalCycleRounds: 2,
  preparationModel: "continuous_fragile" as const,
  rapidShotAllowed: true,
  standardPreparationRounds: 1,
};
const crossbow = {
  ammoFamily: "crossbow_bolt" as const,
  canRemainReady: true,
  family: "crossbow" as const,
  fullNormalCycleRounds: 8,
  preparationModel: "staged_persistent" as const,
  rapidShotAllowed: false,
  standardPreparationRounds: 7,
};

function advance(
  current: Parameters<typeof advanceCombatMissileReadiness>[0]["current"],
  round: number,
) {
  return advanceCombatMissileReadiness({
    commandId: `command-${round}`,
    current,
    intent: {
      aimLevel: 2,
      ammoItemId: "arrows",
      ammoItemRevision: "2026-08-01T00:00:00.000Z",
      gmPreparationAdjustment: 0,
      rapidShot: false,
      targetParticipantId: "target",
    },
    participantId: "archer",
    phase: "phase1",
    profile: bow,
    roundNumber: round,
    submittedAt: `2026-08-${String(round).padStart(2, "0")}T00:00:00.000Z`,
    weaponItemId: "longbow",
    weaponTemplateId: "weapon-template-long-bow",
  });
}

describe("Missile Weapons V1 readiness", () => {
  it("uses the accepted Aim and Rapid shot calibration", () => {
    expect(
      getCombatMissileRequiredRounds({
        aimLevel: 3,
        gmPreparationAdjustment: 0,
        profile: bow,
        rapidShot: false,
      }),
    ).toEqual({ aimRounds: 6, baseRounds: 1, totalRounds: 7 });
    expect(
      getCombatMissileRequiredRounds({
        aimLevel: 0,
        gmPreparationAdjustment: 0,
        profile: bow,
        rapidShot: true,
      }),
    ).toEqual({ aimRounds: 0, baseRounds: 0, totalRounds: 0 });
    expect(() =>
      getCombatMissileRequiredRounds({
        aimLevel: 0,
        gmPreparationAdjustment: 0,
        profile: crossbow,
        rapidShot: true,
      }),
    ).toThrow("cannot use Rapid shot");
  });

  it("prepares one bow round and four target-specific Aim II rounds", () => {
    let state = advance(undefined, 1);
    expect(state.baseCompletedRounds).toBe(1);
    for (let round = 2; round <= 5; round += 1) state = advance(state, round);
    expect(isCombatMissileReady(state)).toBe(true);
    expect(getCombatMissileAttackModifier(state)).toBe(2);
    expect(
      consumeCombatMissileReadinessAfterShot({
        current: state,
        firedAt: "2026-08-06T00:00:00.000Z",
      }),
    ).toMatchObject({ aimCompletedRounds: 0, baseCompletedRounds: 0, status: "idle" });
  });

  it("resets fragile preparation but retains a completed crossbow spanning stage", () => {
    const fragile = interruptCombatMissileReadiness({
      current: advance(undefined, 1),
      interruptedAt: "2026-08-02T00:00:00.000Z",
    });
    expect(fragile).toMatchObject({
      aimCompletedRounds: 0,
      baseCompletedRounds: 0,
      status: "idle",
    });
    const staged = interruptCombatMissileReadiness({
      current: {
        ...advance(undefined, 1),
        ammoFamily: "crossbow_bolt",
        baseCompletedRounds: 6,
        family: "crossbow",
        profile: crossbow,
        status: "spanned",
        weaponItemId: "crossbow",
        weaponTemplateId: "weapon-template-crossbow",
      },
      interruptedAt: "2026-08-02T00:00:00.000Z",
    });
    expect(staged).toMatchObject({ baseCompletedRounds: 6, status: "spanned" });
  });
});
