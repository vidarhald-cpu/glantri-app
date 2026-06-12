import type { WeaponDamageClass } from "../equipment/types";
import type { HitLocation } from "./hitLocation";
import type {
  CriticalFamily,
  CriticalIndex,
  CriticalLocationScope,
} from "./criticalEffectsTable";

export type CriticalMappingStatus = "mapped" | "ambiguous" | "unsupported";

export type CriticalMappingResult<T> =
  | {
      reason?: string;
      status: "mapped";
      value: T;
    }
  | {
      reason: string;
      status: "ambiguous" | "unsupported";
    };

function normalizeCriticalCode(code: string | undefined): string | undefined {
  const normalized = code?.trim().replace(/\s+/g, " ").toUpperCase();

  return normalized && normalized !== "—" ? normalized : undefined;
}

export function mapWeaponDamageClassToCriticalFamily(
  damageClass: string | null | undefined,
): CriticalMappingResult<CriticalFamily> {
  switch (damageClass as WeaponDamageClass | undefined) {
    case "blunt":
      return { status: "mapped", value: "blunt" };
    case "edged":
      return { status: "mapped", value: "sharp" };
    case "pointed":
      return { status: "mapped", value: "pointed_weapons" };
    case undefined:
    case null:
      return {
        reason: "Weapon damage class is not available for critical table lookup.",
        status: "unsupported",
      };
    default:
      return {
        reason: `Weapon damage class '${damageClass}' is not mapped to a critical table family.`,
        status: "unsupported",
      };
  }
}

export function mapWeaponCriticalCodeToFamily(
  mcCode: string | undefined,
): CriticalMappingResult<CriticalFamily> {
  const normalized = normalizeCriticalCode(mcCode);

  if (!normalized) {
    return {
      reason: "Weapon MC/critical code is not available for critical table lookup.",
      status: "unsupported",
    };
  }

  if (["AC", "CC", "DC", "EC", "FC"].includes(normalized)) {
    return { status: "mapped", value: "blunt" };
  }

  if (["AS", "BS", "CS"].includes(normalized)) {
    return { status: "mapped", value: "sharp" };
  }

  if (
    ["AP", "BP", "CP", "DP", "FP AC", "FP AS", "FP BS", "FP CS", "FP DC", "FC DP/EP*"].includes(
      normalized,
    )
  ) {
    return { status: "mapped", value: "pointed_weapons" };
  }

  if (["DS", "EP", "ES", "FP", "FS"].includes(normalized)) {
    return {
      reason: `Weapon MC/critical code '${normalized}' appears with more than one damage class in current weapon data; critical family needs the attack mode damage class.`,
      status: "ambiguous",
    };
  }

  return {
    reason: `Weapon MC/critical code '${normalized}' is not mapped to a critical table family.`,
    status: "unsupported",
  };
}

export function mapWeaponCriticalInputToFamily(input: {
  weaponCriticalCode?: string;
  weaponDamageClass?: string | null;
}): CriticalMappingResult<CriticalFamily> {
  const damageClassResult = mapWeaponDamageClassToCriticalFamily(input.weaponDamageClass);

  if (damageClassResult.status === "mapped") {
    return damageClassResult;
  }

  const codeResult = mapWeaponCriticalCodeToFamily(input.weaponCriticalCode);

  if (codeResult.status === "mapped") {
    return codeResult;
  }

  if (codeResult.status === "ambiguous") {
    return codeResult;
  }

  return {
    reason: `${damageClassResult.reason} ${codeResult.reason}`,
    status: "unsupported",
  };
}

export function mapCombatHitLocationToCriticalLocation(
  hitLocation: HitLocation | undefined,
): CriticalMappingResult<CriticalLocationScope> {
  switch (hitLocation) {
    case "head":
      return { status: "mapped", value: "head" };
    case "rightArm":
    case "leftArm":
      return { status: "mapped", value: "arm" };
    case "chest":
      return { status: "mapped", value: "chest" };
    case "abdomen":
      return { status: "mapped", value: "abdomen" };
    case "rightLeg":
    case "leftLeg":
      return {
        reason:
          "Combat hit location is a whole leg, but the critical table distinguishes upper_leg and lower_leg.",
        status: "ambiguous",
      };
    case undefined:
      return {
        reason: "Hit location is not available for critical table lookup.",
        status: "unsupported",
      };
    default:
      return {
        reason: `Hit location '${hitLocation}' is not mapped to a critical table location.`,
        status: "unsupported",
      };
  }
}

export function mapFinalCriticalRollToCritIndex(
  finalCriticalRoll: number | undefined,
): CriticalMappingResult<CriticalIndex> {
  if (finalCriticalRoll === undefined || !Number.isInteger(finalCriticalRoll)) {
    return {
      reason: "Final critical roll is not an integer.",
      status: "unsupported",
    };
  }

  if (finalCriticalRoll < 1 || finalCriticalRoll > 16) {
    return {
      reason: `Final critical roll ${finalCriticalRoll} is outside the supported critical table index range 1-16; no clamping rule is approved.`,
      status: "unsupported",
    };
  }

  return {
    status: "mapped",
    value: finalCriticalRoll as CriticalIndex,
  };
}
