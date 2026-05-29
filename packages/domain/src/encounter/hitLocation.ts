import { z } from "zod";

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

export const HIT_LOCATIONS = hitLocationSchema.options;

const HIT_LOCATION_ROLLS = {
  abdomen: [7, 8, 9, 10],
  chest: [11, 12, 13, 14],
  head: [19, 20],
  leftArm: [15, 16],
  leftLeg: [1, 2, 3],
  rightArm: [17, 18],
  rightLeg: [4, 5, 6],
} satisfies Record<HitLocation, number[]>;

const HIT_LOCATION_SHORT_LABELS = {
  abdomen: "Abd",
  chest: "Chest",
  head: "Head",
  leftArm: "L arm",
  leftLeg: "L leg",
  rightArm: "R arm",
  rightLeg: "R leg",
} satisfies Record<HitLocation, string>;

const HIT_LOCATION_FULL_LABELS = {
  abdomen: "Abdomen",
  chest: "Chest",
  head: "Head",
  leftArm: "Left arm",
  leftLeg: "Left leg",
  rightArm: "Right arm",
  rightLeg: "Right leg",
} satisfies Record<HitLocation, string>;

function assertClosedD20Roll(roll: number): void {
  if (!Number.isInteger(roll) || roll < 1 || roll > 20) {
    throw new RangeError("Hit location roll must be a closed 1d20 value from 1 to 20.");
  }
}

function getHitLocationTargetDistance(location: HitLocation, roll: number): number {
  return Math.min(...HIT_LOCATION_ROLLS[location].map((targetRoll) => Math.abs(roll - targetRoll)));
}

export function resolveHitLocationRoll(roll: number): HitLocation {
  assertClosedD20Roll(roll);

  const match = HIT_LOCATIONS.find((location) => HIT_LOCATION_ROLLS[location].includes(roll));

  if (!match) {
    throw new RangeError("Hit location roll must resolve to a known location.");
  }

  return match;
}

export function getHitLocationShortLabel(location: HitLocation): string {
  return HIT_LOCATION_SHORT_LABELS[location];
}

export function getHitLocationFullLabel(location: HitLocation): string {
  return HIT_LOCATION_FULL_LABELS[location];
}

export function chooseTargetedHitLocationRoll(
  targetLocation: HitLocationTarget | undefined,
  rollA: number,
  rollB?: number,
): number {
  assertClosedD20Roll(rollA);

  if (!targetLocation || targetLocation === "none") {
    return rollA;
  }

  if (rollB === undefined) {
    return rollA;
  }

  assertClosedD20Roll(rollB);

  const distanceA = getHitLocationTargetDistance(targetLocation, rollA);
  const distanceB = getHitLocationTargetDistance(targetLocation, rollB);

  return distanceA <= distanceB ? rollA : rollB;
}
