import { describe, expect, it } from "vitest";

import type { EncounterAttackResolution } from "@glantri/domain";

import {
  determineEncounterCriticalEscalation,
  resolveEncounterCritical,
} from "./resolveEncounterCritical";

// ---------------------------------------------------------------------------
// Minimal fixture factory — constructs only the fields that the critical
// helpers actually read, leaving the rest as schema-valid defaults.
// ---------------------------------------------------------------------------

const PROVISIONAL_RULE_LABEL =
  "REVIEW_FLAG: Critical escalation currently uses a provisional final-damage threshold because no finalized crit trigger rule is modeled yet.";

function makeResolution(
  overrides: Partial<EncounterAttackResolution>,
): EncounterAttackResolution {
  return {
    id: "res-test-1",
    encounterId: "encounter-test-1",
    attackerParticipantId: "attacker-1",
    defenderParticipantId: "defender-1",
    order: 0,
    roundNumber: 1,
    resolvedAt: new Date().toISOString(),
    outcome: "hit-pending-damage",
    declaration: {
      actionType: "attack",
      defenseFocus: "none",
      defensePosture: "none",
      targetLocation: "any",
    },
    attackRoll: {
      baseOb: 10,
      defenseTarget: 5,
      hit: true,
      margin: 5,
      roll: 50,
      total: 60,
    },
    defense: {
      dbApplied: false,
      dbValue: 0,
      defending: false,
      parryAttempted: false,
      parryBase: 0,
      parrySucceeded: false,
    },
    ...overrides,
  };
}

describe("determineEncounterCriticalEscalation", () => {
  it("does not trigger a critical when finalDamage is below the threshold (12)", () => {
    const resolution = makeResolution({
      damage: {
        armorValue: 0,
        criticalPending: false,
        finalDamage: 11,
        rawDamage: 11,
        weaponArmorModifier: 0,
      },
    });

    const result = determineEncounterCriticalEscalation({ resolution });

    expect(result.criticalPending).toBe(false);
    expect(result.triggerDamage).toBe(11);
    expect(result.triggerThreshold).toBe(12);
  });

  it("triggers a critical exactly at the threshold (12)", () => {
    const resolution = makeResolution({
      damage: {
        armorValue: 0,
        criticalPending: false,
        finalDamage: 12,
        rawDamage: 12,
        weaponArmorModifier: 0,
      },
    });

    const result = determineEncounterCriticalEscalation({ resolution });

    expect(result.criticalPending).toBe(true);
    expect(result.triggerDamage).toBe(12);
  });

  it("triggers a critical when finalDamage exceeds the threshold", () => {
    const resolution = makeResolution({
      damage: {
        armorValue: 2,
        criticalPending: false,
        finalDamage: 20,
        rawDamage: 22,
        weaponArmorModifier: -2,
      },
    });

    const result = determineEncounterCriticalEscalation({ resolution });

    expect(result.criticalPending).toBe(true);
    expect(result.triggerDamage).toBe(20);
  });

  it("returns 'general' critical type for torso hits", () => {
    const resolution = makeResolution({
      hitLocation: { aimedLocation: "torso", resolvedLocation: "torso" },
      damage: { armorValue: 0, criticalPending: false, finalDamage: 15, rawDamage: 15, weaponArmorModifier: 0 },
    });

    expect(determineEncounterCriticalEscalation({ resolution }).criticalType).toBe("general");
  });

  it("returns 'general' critical type for head hits", () => {
    const resolution = makeResolution({
      hitLocation: { aimedLocation: "any", resolvedLocation: "head", roll: 5 },
      damage: { armorValue: 0, criticalPending: false, finalDamage: 15, rawDamage: 15, weaponArmorModifier: 0 },
    });

    expect(determineEncounterCriticalEscalation({ resolution }).criticalType).toBe("general");
  });

  it("returns 'limb' critical type for arm hits", () => {
    const resolution = makeResolution({
      hitLocation: { aimedLocation: "arm", resolvedLocation: "arm" },
      damage: { armorValue: 0, criticalPending: false, finalDamage: 15, rawDamage: 15, weaponArmorModifier: 0 },
    });

    expect(determineEncounterCriticalEscalation({ resolution }).criticalType).toBe("limb");
  });

  it("returns 'limb' critical type for leg hits", () => {
    const resolution = makeResolution({
      hitLocation: { aimedLocation: "leg", resolvedLocation: "leg" },
      damage: { armorValue: 0, criticalPending: false, finalDamage: 15, rawDamage: 15, weaponArmorModifier: 0 },
    });

    expect(determineEncounterCriticalEscalation({ resolution }).criticalType).toBe("limb");
  });

  it("always includes the provisional rule label", () => {
    const resolution = makeResolution({
      damage: { armorValue: 0, criticalPending: false, finalDamage: 5, rawDamage: 5, weaponArmorModifier: 0 },
    });

    expect(
      determineEncounterCriticalEscalation({ resolution }).provisionalRuleLabel,
    ).toBe(PROVISIONAL_RULE_LABEL);
  });
});

describe("resolveEncounterCritical", () => {
  function makeCriticalPendingResolution(
    finalDamage: number,
    resolvedLocation: EncounterAttackResolution["hitLocation"],
  ): EncounterAttackResolution {
    return makeResolution({
      outcome: "critical-pending",
      hitLocation: resolvedLocation,
      damage: {
        armorValue: 0,
        criticalPending: true,
        finalDamage,
        rawDamage: finalDamage,
        weaponArmorModifier: 0,
      },
      critical: {
        provisionalRuleLabel: PROVISIONAL_RULE_LABEL,
        roll: { baseModifier: 0, locationModifier: 0, totalModifier: 0 },
        status: "pending",
        triggerDamage: finalDamage,
        triggerThreshold: 12,
        type: "general",
      },
    });
  }

  it("rejects a resolution that is not in critical-pending outcome", () => {
    const resolution = makeResolution({ outcome: "hit" });
    const result = resolveEncounterCritical({ criticalRoll: 50, resolution });

    expect(result.errors).toContain(
      "Only critical-pending results can be resolved for critical effects.",
    );
    expect(result.resolution).toBeUndefined();
  });

  it("rejects when critical status is not pending", () => {
    const resolution = makeResolution({
      outcome: "critical-pending",
      critical: {
        roll: { baseModifier: 0, locationModifier: 0, totalModifier: 0 },
        status: "resolved",
        triggerDamage: 15,
        triggerThreshold: 12,
      },
    });

    const result = resolveEncounterCritical({ criticalRoll: 50, resolution });

    expect(result.errors).toContain(
      "Critical resolution requires a pending critical state.",
    );
  });

  it("resolves a torso hit with moderate roll as minor critical", () => {
    // torso: locationModifier = 5; finalDamage = 12 → baseModifier = 12
    // totalModifier = 17; roll = 50 → finalRoll = 67 → minor (< 80)
    const resolution = makeCriticalPendingResolution(
      12,
      { aimedLocation: "any", resolvedLocation: "torso" },
    );
    const result = resolveEncounterCritical({ criticalRoll: 50, resolution });

    expect(result.errors).toHaveLength(0);
    expect(result.resolution?.outcome).toBe("critical-resolved");
    expect(result.resolution?.critical?.effect?.severity).toBe("minor");
    expect(result.resolution?.critical?.roll?.finalRoll).toBe(67);
  });

  it("resolves a head hit with high roll as major critical", () => {
    // head: locationModifier = 10; finalDamage = 12 → baseModifier = 12
    // totalModifier = 22; roll = 60 → finalRoll = 82 → major (≥ 80, < 120)
    const resolution = makeCriticalPendingResolution(
      12,
      { aimedLocation: "any", resolvedLocation: "head", roll: 5 },
    );
    const result = resolveEncounterCritical({ criticalRoll: 60, resolution });

    expect(result.errors).toHaveLength(0);
    expect(result.resolution?.critical?.effect?.severity).toBe("major");
    expect(result.resolution?.critical?.roll?.finalRoll).toBe(82);
  });

  it("resolves a head hit with very high roll as severe critical", () => {
    // head: locationModifier = 10; finalDamage = 20 → baseModifier = 20
    // totalModifier = 30; roll = 95 → finalRoll = 125 → severe (≥ 120)
    const resolution = makeCriticalPendingResolution(
      20,
      { aimedLocation: "head", resolvedLocation: "head" },
    );
    const result = resolveEncounterCritical({ criticalRoll: 95, resolution });

    expect(result.errors).toHaveLength(0);
    expect(result.resolution?.critical?.effect?.severity).toBe("severe");
    expect(result.resolution?.critical?.roll?.finalRoll).toBe(125);
  });

  it("resolves an arm hit as a limb type critical", () => {
    const resolution = makeResolution({
      outcome: "critical-pending",
      hitLocation: { aimedLocation: "arm", resolvedLocation: "arm" },
      damage: { armorValue: 0, criticalPending: true, finalDamage: 15, rawDamage: 15, weaponArmorModifier: 0 },
      critical: {
        provisionalRuleLabel: PROVISIONAL_RULE_LABEL,
        roll: { baseModifier: 0, locationModifier: 0, totalModifier: 0 },
        status: "pending",
        triggerDamage: 15,
        triggerThreshold: 12,
        type: "limb",
      },
    });

    const result = resolveEncounterCritical({ criticalRoll: 50, resolution });

    expect(result.errors).toHaveLength(0);
    expect(result.resolution?.critical?.type).toBe("limb");
    expect(result.resolution?.critical?.effect?.tags).toContain("critical");
  });

  it("clamps the incoming critical roll to 1–100", () => {
    const resolution = makeCriticalPendingResolution(
      12,
      { aimedLocation: "torso", resolvedLocation: "torso" },
    );

    // roll 200 → clamped to 100; torso modifier 5; damage 12 → finalRoll = 117 → major (≥ 80)
    const highResult = resolveEncounterCritical({ criticalRoll: 200, resolution });
    expect(highResult.resolution?.critical?.roll?.roll).toBe(100);

    // roll 0 → clamped to 1; torso modifier 5; damage 12 → finalRoll = 18 → minor
    const lowResult = resolveEncounterCritical({ criticalRoll: 0, resolution });
    expect(lowResult.resolution?.critical?.roll?.roll).toBe(1);
  });
});
