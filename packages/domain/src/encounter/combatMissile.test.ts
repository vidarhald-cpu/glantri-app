import { describe, expect, it } from "vitest";

import {
  advanceCombatMissileReadiness,
  canInterruptCombatMissileReadiness,
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

function advanceCrossbow(input: {
  aimLevel?: 0 | 1 | 2 | 3;
  current?: Parameters<typeof advanceCombatMissileReadiness>[0]["current"];
  gmPreparationAdjustment?: number;
  round: number;
  targetParticipantId?: string;
}) {
  return advanceCombatMissileReadiness({
    commandId: `crossbow-command-${input.round}`,
    current: input.current,
    intent: {
      aimLevel: input.aimLevel ?? 0,
      ammoItemId: "bolts",
      ammoItemRevision: "2026-08-01T00:00:00.000Z",
      gmPreparationAdjustment: input.gmPreparationAdjustment ?? 0,
      rapidShot: false,
      targetParticipantId: input.targetParticipantId ?? "target",
    },
    participantId: "archer",
    phase: "phase1",
    profile: crossbow,
    roundNumber: input.round,
    submittedAt: `2026-08-${String(input.round).padStart(2, "0")}T00:00:00.000Z`,
    weaponItemId: "crossbow",
    weaponTemplateId: "weapon-template-crossbow",
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
    expect(state).toMatchObject({ aimRequiredRounds: 4, baseRequiredRounds: 1 });
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
    expect(canInterruptCombatMissileReadiness(staged)).toBe(false);
    expect(canInterruptCombatMissileReadiness(advance(undefined, 1))).toBe(true);
  });

  it("preserves only completed persistent crossbow stages across interruption", () => {
    let partial = advanceCrossbow({ round: 1 });
    for (let round = 2; round <= 5; round += 1) {
      partial = advanceCrossbow({ current: partial, round });
    }
    expect(partial).toMatchObject({ baseCompletedRounds: 5, status: "preparing" });
    expect(
      interruptCombatMissileReadiness({
        current: partial,
        interruptedAt: "2026-08-06T00:00:00.000Z",
      }),
    ).toMatchObject({ baseCompletedRounds: 0, status: "idle" });

    const spanned = advanceCrossbow({ current: partial, round: 6 });
    expect(spanned).toMatchObject({ baseCompletedRounds: 6, status: "spanned" });
    expect(
      interruptCombatMissileReadiness({
        current: spanned,
        interruptedAt: "2026-08-07T00:00:00.000Z",
      }),
    ).toMatchObject({ baseCompletedRounds: 6, status: "spanned" });

    const loaded = advanceCrossbow({ current: spanned, round: 7 });
    expect(loaded).toMatchObject({ baseCompletedRounds: 7, status: "loaded" });
    const loadedAiming = advanceCrossbow({ aimLevel: 1, current: loaded, round: 8 });
    expect(loadedAiming).toMatchObject({
      aimCompletedRounds: 1,
      baseCompletedRounds: 7,
      status: "loaded",
    });
    const interrupted = interruptCombatMissileReadiness({
      current: loadedAiming,
      interruptedAt: "2026-08-09T00:00:00.000Z",
    });
    expect(interrupted).toMatchObject({
      aimCompletedRounds: 0,
      aimLevel: 0,
      baseCompletedRounds: 7,
      status: "loaded",
      targetParticipantId: undefined,
    });
    expect(canInterruptCombatMissileReadiness(interrupted)).toBe(false);
  });

  it("scopes a GM timing adjustment to one shot while retaining a loaded stage", () => {
    let adjusted = advanceCrossbow({ gmPreparationAdjustment: -3, round: 1 });
    for (let round = 2; round <= 4; round += 1) {
      adjusted = advanceCrossbow({ current: adjusted, gmPreparationAdjustment: -3, round });
    }
    expect(adjusted).toMatchObject({
      baseCompletedRounds: 4,
      baseRequiredRounds: 4,
      gmPreparationAdjustment: -3,
      status: "loaded",
    });
    const nextTask = advanceCrossbow({
      current: { ...adjusted, targetParticipantId: undefined },
      gmPreparationAdjustment: 0,
      round: 5,
      targetParticipantId: "new-target",
    });
    expect(nextTask).toMatchObject({
      baseCompletedRounds: 7,
      baseRequiredRounds: 7,
      gmPreparationAdjustment: 0,
      status: "loaded",
    });
    expect(
      consumeCombatMissileReadinessAfterShot({
        current: nextTask,
        firedAt: "2026-08-06T00:00:00.000Z",
      }),
    ).toMatchObject({
      baseCompletedRounds: 0,
      baseRequiredRounds: 7,
      gmPreparationAdjustment: 0,
      status: "idle",
    });
  });
});
