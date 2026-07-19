import { z } from "zod";

import {
  assertClosedDieRoll,
  expandClosedDieRuleTable,
  resolveClosedDieRuleTableRoll,
} from "../rules/ruleTable";

export const hitLocationSchema = z.enum([
  "head",
  "rightArm",
  "leftArm",
  "chest",
  "abdomen",
  "upperRightLeg",
  "lowerRightLeg",
  "upperLeftLeg",
  "lowerLeftLeg",
  "rightLeg",
  "leftLeg",
]);

export const hitLocationTargetSchema = z.union([hitLocationSchema, z.literal("none")]);

export type HitLocation = z.infer<typeof hitLocationSchema>;
export type HitLocationTarget = z.infer<typeof hitLocationTargetSchema>;
export type HitLocationSelectionReason = "single_roll" | "targeted_closest";

export interface HitLocationSelection {
  hitLocationRolls: readonly number[];
  hitLocationSelectionReason: HitLocationSelectionReason;
  selectedHitLocation: HitLocation;
  selectedHitLocationRoll: number;
  targetLocation?: HitLocationTarget;
}

export const HIT_LOCATIONS = [
  "head",
  "rightArm",
  "leftArm",
  "chest",
  "abdomen",
  "upperRightLeg",
  "lowerRightLeg",
  "upperLeftLeg",
  "lowerLeftLeg",
] as const satisfies readonly HitLocation[];

const HIT_LOCATION_LABELS = {
  abdomen: { fullLabel: "Abdomen", shortLabel: "Abd" },
  chest: { fullLabel: "Chest", shortLabel: "Chest" },
  head: { fullLabel: "Head", shortLabel: "Head" },
  leftArm: { fullLabel: "Left arm", shortLabel: "L arm" },
  leftLeg: { fullLabel: "Left leg", shortLabel: "L leg" },
  lowerLeftLeg: { fullLabel: "Lower left leg", shortLabel: "L lower" },
  lowerRightLeg: { fullLabel: "Lower right leg", shortLabel: "R lower" },
  rightArm: { fullLabel: "Right arm", shortLabel: "R arm" },
  rightLeg: { fullLabel: "Right leg", shortLabel: "R leg" },
  upperLeftLeg: { fullLabel: "Upper left leg", shortLabel: "L upper" },
  upperRightLeg: { fullLabel: "Upper right leg", shortLabel: "R upper" },
} satisfies Record<HitLocation, { fullLabel: string; shortLabel: string }>;

export const HIT_LOCATION_RULE_TABLE = {
  bands: [
    { fullLabel: "Head", key: "head", maxRoll: 20, minRoll: 19, shortLabel: "Head" },
    { fullLabel: "Right arm", key: "rightArm", maxRoll: 18, minRoll: 17, shortLabel: "R arm" },
    { fullLabel: "Left arm", key: "leftArm", maxRoll: 16, minRoll: 15, shortLabel: "L arm" },
    { fullLabel: "Chest", key: "chest", maxRoll: 14, minRoll: 11, shortLabel: "Chest" },
    { fullLabel: "Abdomen", key: "abdomen", maxRoll: 10, minRoll: 7, shortLabel: "Abd" },
    {
      fullLabel: "Upper right leg",
      key: "upperRightLeg",
      maxRoll: 6,
      minRoll: 5,
      shortLabel: "R upper",
    },
    {
      fullLabel: "Lower right leg",
      key: "lowerRightLeg",
      maxRoll: 4,
      minRoll: 4,
      shortLabel: "R lower",
    },
    {
      fullLabel: "Upper left leg",
      key: "upperLeftLeg",
      maxRoll: 3,
      minRoll: 2,
      shortLabel: "L upper",
    },
    {
      fullLabel: "Lower left leg",
      key: "lowerLeftLeg",
      maxRoll: 1,
      minRoll: 1,
      shortLabel: "L lower",
    },
  ],
  dieLabel: "1d20",
  id: "combat-hit-location",
  notes: [
    "If no location is aimed, use one closed 1d20 roll.",
    "If an attacker aims at a location, roll closed 1d20 twice and use the roll closest to the aimed location.",
    "Distance to an aimed location is measured by table location order; ties use the first roll.",
  ],
  rollOrder: "descending",
  sides: 20,
  source: {
    range: "A1:C21",
    sheet: "Location table",
    workbook: "docs/source/combat/New_Combat_Arena.xlsx",
  },
  title: "Combat Hit Location",
} as const;

function normalizeLegacyHitLocationForOrder(location: HitLocation): HitLocation {
  switch (location) {
    case "leftLeg":
      return "upperLeftLeg";
    case "rightLeg":
      return "upperRightLeg";
    default:
      return location;
  }
}

export function resolveHitLocationRoll(roll: number): HitLocation {
  return resolveClosedDieRuleTableRoll(HIT_LOCATION_RULE_TABLE, roll).key;
}

export function expandHitLocationTable() {
  return expandClosedDieRuleTable(HIT_LOCATION_RULE_TABLE);
}

export function getHitLocationShortLabel(location: HitLocation): string {
  return HIT_LOCATION_LABELS[location].shortLabel;
}

export function getHitLocationFullLabel(location: HitLocation): string {
  return HIT_LOCATION_LABELS[location].fullLabel;
}

export function getHitLocationOrderIndex(location: HitLocation): number {
  const normalizedLocation = normalizeLegacyHitLocationForOrder(location);
  const index = HIT_LOCATION_RULE_TABLE.bands.findIndex(
    (band) => band.key === normalizedLocation,
  );

  if (index === -1) {
    throw new RangeError(`Unknown hit location: ${location}`);
  }

  return index;
}

export function chooseTargetedHitLocationRoll(
  targetLocation: HitLocationTarget | undefined,
  rollA: number,
  rollB?: number,
): number {
  assertClosedDieRoll(HIT_LOCATION_RULE_TABLE, rollA);

  if (!targetLocation || targetLocation === "none") {
    return rollA;
  }

  if (rollB === undefined) {
    return rollA;
  }

  assertClosedDieRoll(HIT_LOCATION_RULE_TABLE, rollB);

  const targetIndex = getHitLocationOrderIndex(targetLocation);
  const distanceA = Math.abs(getHitLocationOrderIndex(resolveHitLocationRoll(rollA)) - targetIndex);
  const distanceB = Math.abs(getHitLocationOrderIndex(resolveHitLocationRoll(rollB)) - targetIndex);

  return distanceA <= distanceB ? rollA : rollB;
}

export function resolveHitLocationSelection(input: {
  rollA: number;
  rollB?: number;
  targetLocation?: HitLocationTarget;
}): HitLocationSelection {
  const targeted = Boolean(input.targetLocation && input.targetLocation !== "none");
  const selectedHitLocationRoll = chooseTargetedHitLocationRoll(
    input.targetLocation,
    input.rollA,
    input.rollB,
  );

  return {
    hitLocationRolls: targeted && input.rollB !== undefined
      ? [input.rollA, input.rollB]
      : [input.rollA],
    hitLocationSelectionReason: targeted ? "targeted_closest" : "single_roll",
    selectedHitLocation: resolveHitLocationRoll(selectedHitLocationRoll),
    selectedHitLocationRoll,
    targetLocation: input.targetLocation,
  };
}
