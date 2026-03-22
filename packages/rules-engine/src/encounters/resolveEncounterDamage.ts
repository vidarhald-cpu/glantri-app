import type {
  CharacterBuild,
  EncounterAttackResolution,
  EncounterTargetLocation
} from "@glantri/domain";

import { encounterAttackResolutionSchema } from "@glantri/domain";

import { determineEncounterCriticalEscalation } from "./resolveEncounterCritical";

export interface ResolveEncounterDamageResult {
  errors: string[];
  resolution?: EncounterAttackResolution;
  warnings: string[];
}

function clampPercentileRoll(roll: number): number {
  return Math.max(1, Math.min(100, Math.round(roll)));
}

function mapRollToLocation(roll: number): Exclude<EncounterTargetLocation, "any"> {
  if (roll <= 10) {
    return "head";
  }

  if (roll <= 50) {
    return "torso";
  }

  if (roll <= 75) {
    return "arm";
  }

  return "leg";
}

function parseResolution(resolution: EncounterAttackResolution): EncounterAttackResolution {
  return encounterAttackResolutionSchema.parse(resolution);
}

export function resolveEncounterHitLocation(input: {
  declaredTargetLocation: EncounterTargetLocation;
  hitLocationRoll: number;
}): NonNullable<EncounterAttackResolution["hitLocation"]> {
  const normalizedRoll = clampPercentileRoll(input.hitLocationRoll);

  if (input.declaredTargetLocation !== "any") {
    return {
      aimedLocation: input.declaredTargetLocation,
      resolvedLocation: input.declaredTargetLocation
    };
  }

  return {
    aimedLocation: "any",
    resolvedLocation: mapRollToLocation(normalizedRoll),
    roll: normalizedRoll
  };
}

export function lookupEncounterArmorAtLocation(input: {
  build?: CharacterBuild;
  resolvedLocation: EncounterTargetLocation;
}): {
  armorLabel?: string;
  armorValue: number;
} {
  const equippedArmor =
    input.build?.equipment.items.filter((item) => item.equipped && item.itemType === "armor") ?? [];

  if (equippedArmor.length === 0) {
    return {
      armorValue: 0
    };
  }

  return {
    armorLabel:
      equippedArmor
        .map((item) => item.armorLabel ?? item.name)
        .filter(Boolean)
        .join(", ") || `${input.resolvedLocation} armor`,
    armorValue: equippedArmor.reduce((sum, item) => sum + (item.armorValue ?? 0), 0)
  };
}

export function applyEncounterWeaponArmorModifier(input: {
  armorValue: number;
  weaponBonus: number;
}): number {
  return input.weaponBonus - input.armorValue;
}

export function resolveEncounterDamage(input: {
  attackerBuild?: CharacterBuild;
  defenderBuild?: CharacterBuild;
  hitLocationRoll: number;
  resolution: EncounterAttackResolution;
}): ResolveEncounterDamageResult {
  const resolution = parseResolution(input.resolution);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (resolution.outcome !== "hit-pending-damage") {
    errors.push("Only hit-pending-damage resolutions can be resolved for damage.");
  }

  if (!input.attackerBuild) {
    errors.push("Damage resolution requires a linked attacker character.");
  }

  if (errors.length > 0) {
    return {
      errors,
      warnings
    };
  }

  const selectedWeapon = resolution.selectedWeaponItemId
    ? input.attackerBuild?.equipment.items.find((item) => item.id === resolution.selectedWeaponItemId)
    : undefined;

  if (!selectedWeapon) {
    return {
      errors: ["Damage resolution requires the originally selected weapon."],
      warnings
    };
  }

  const hitLocation = resolveEncounterHitLocation({
    declaredTargetLocation: resolution.declaration.targetLocation,
    hitLocationRoll: input.hitLocationRoll
  });
  const armor = lookupEncounterArmorAtLocation({
    build: input.defenderBuild,
    resolvedLocation: hitLocation.resolvedLocation
  });
  const rawDamage = Math.max(0, resolution.attackRoll.margin);
  const weaponArmorModifier = applyEncounterWeaponArmorModifier({
    armorValue: armor.armorValue,
    weaponBonus: selectedWeapon.weaponBonus ?? 0
  });
  const finalDamage = Math.max(0, rawDamage + weaponArmorModifier);
  const criticalEscalation = determineEncounterCriticalEscalation({
    resolution: {
      ...resolution,
      damage: {
        armorLabel: armor.armorLabel,
        armorValue: armor.armorValue,
        criticalPending: false,
        finalDamage,
        rawDamage,
        weaponArmorModifier
      },
      hitLocation
    }
  });
  const criticalPending = criticalEscalation.criticalPending;

  if (resolution.declaration.targetLocation !== "any") {
    warnings.push("Aimed location was applied directly; no separate location roll was used.");
  }

  if (armor.armorValue === 0) {
    warnings.push("No modeled armor value was available for the resolved location.");
  }

  warnings.push(criticalEscalation.provisionalRuleLabel);

  return {
    errors: [],
    resolution: parseResolution({
      ...resolution,
      critical: {
        provisionalRuleLabel: criticalEscalation.provisionalRuleLabel,
        roll: {
          baseModifier: 0,
          locationModifier: 0,
          totalModifier: 0
        },
        status: criticalPending ? "pending" : "none",
        triggerDamage: criticalEscalation.triggerDamage,
        triggerThreshold: criticalEscalation.triggerThreshold,
        type: criticalEscalation.criticalType
      },
      damage: {
        armorLabel: armor.armorLabel,
        armorValue: armor.armorValue,
        criticalPending,
        finalDamage,
        rawDamage,
        weaponArmorModifier
      },
      hitLocation,
      outcome: criticalPending ? "critical-pending" : "hit"
    }),
    warnings
  };
}

export function updateEncounterAttackResolution(input: {
  resolution: EncounterAttackResolution;
  sessionActionLog: EncounterAttackResolution[];
}): EncounterAttackResolution[] {
  return input.sessionActionLog.map((entry) =>
    entry.id === input.resolution.id ? parseResolution(input.resolution) : entry
  );
}
