import { z } from "zod";

import {
  assertClosedDieRoll,
  expandClosedDieRuleTable,
  resolveClosedDieRuleTableRoll,
  type ClosedDieRuleTableBand,
} from "../rules/ruleTable";

export const hitLocationSchema = z.enum([
  "head",
  "rightArm",
  "leftArm",
  "chest",
  "abdomen",
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

export const HIT_LOCATIONS = hitLocationSchema.options;

export const HIT_LOCATION_RULE_TABLE = {
  bands: [
    { fullLabel: "Head", key: "head", maxRoll: 20, minRoll: 19, shortLabel: "Head" },
    { fullLabel: "Right arm", key: "rightArm", maxRoll: 18, minRoll: 17, shortLabel: "R arm" },
    { fullLabel: "Left arm", key: "leftArm", maxRoll: 16, minRoll: 15, shortLabel: "L arm" },
    { fullLabel: "Chest", key: "chest", maxRoll: 14, minRoll: 11, shortLabel: "Chest" },
    { fullLabel: "Abdomen", key: "abdomen", maxRoll: 10, minRoll: 7, shortLabel: "Abd" },
    { fullLabel: "Right leg", key: "rightLeg", maxRoll: 6, minRoll: 4, shortLabel: "R leg" },
    { fullLabel: "Left leg", key: "leftLeg", maxRoll: 3, minRoll: 1, shortLabel: "L leg" },
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

function getHitLocationBand(location: HitLocation): ClosedDieRuleTableBand<HitLocation> {
  const band = HIT_LOCATION_RULE_TABLE.bands.find((candidate) => candidate.key === location);

  if (!band) {
    throw new RangeError(`Unknown hit location: ${location}`);
  }

  return band;
}

export function resolveHitLocationRoll(roll: number): HitLocation {
  return resolveClosedDieRuleTableRoll(HIT_LOCATION_RULE_TABLE, roll).key;
}

export function expandHitLocationTable() {
  return expandClosedDieRuleTable(HIT_LOCATION_RULE_TABLE);
}

export function getHitLocationShortLabel(location: HitLocation): string {
  return getHitLocationBand(location).shortLabel;
}

export function getHitLocationFullLabel(location: HitLocation): string {
  return getHitLocationBand(location).fullLabel;
}

export function getHitLocationOrderIndex(location: HitLocation): number {
  const index = HIT_LOCATION_RULE_TABLE.bands.findIndex((band) => band.key === location);

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
