import type {
  GlantriCharacteristicBlock,
  RolledCharacterProfile
} from "@glantri/domain";

import { glantriCharacteristicOrder } from "@glantri/domain";
import {
  getDexteritySizeModifier,
  getGlantriStatModifier
} from "../stats/characteristicGms";

export interface GenerateProfilesInput {
  count?: number;
  rollSets?: GlantriCharacteristicBlock[];
  rng?: () => number;
  socialClassTableId?: string;
}

const DEFAULT_PROFILE_COUNT = 20;
const DEFAULT_SOCIAL_CLASS_TABLE_ID = "scandia_social_class_v1";
const SOCIAL_CLASS_THRESHOLDS = [
  { educationValue: 2, maxRoll: 10, result: "Bønder" },
  { educationValue: 4, maxRoll: 15, result: "Håndverkere" },
  { educationValue: 6, maxRoll: 18, result: "Storbønder" },
  { educationValue: 8, maxRoll: 20, result: "Adelen" }
] as const;

function rollDie(rng: () => number, sides: number): number {
  return Math.floor(rng() * sides) + 1;
}

function rollFourD6DropLowest(rng: () => number): number {
  const rolls = Array.from({ length: 4 }, () => rollDie(rng, 6));
  return rolls.reduce((sum, value) => sum + value, 0) - Math.min(...rolls);
}

function rollBestOfTwoD20(rng: () => number): number {
  return Math.max(rollDie(rng, 20), rollDie(rng, 20));
}

function rollDistractionLevel(rng: () => number): number {
  return rollDie(rng, 3) + rollDie(rng, 3);
}

function rollSocialClass(input: {
  rng: () => number;
  tableId: string;
}): {
  educationValue: number;
  roll: number;
  result: string;
  tableId: string;
} {
  if (input.tableId !== DEFAULT_SOCIAL_CLASS_TABLE_ID) {
    throw new Error(`Unsupported social class table: ${input.tableId}`);
  }

  const roll = rollBestOfTwoD20(input.rng);
  const threshold = SOCIAL_CLASS_THRESHOLDS.find((entry) => roll <= entry.maxRoll);

  return {
    educationValue: threshold?.educationValue ?? 0,
    roll,
    result: threshold?.result ?? "Bønder",
    tableId: input.tableId
  };
}

function generateCharacteristicBlock(rng: () => number): GlantriCharacteristicBlock {
  const raw = {
    cha: rollFourD6DropLowest(rng),
    com: rollFourD6DropLowest(rng),
    con: rollFourD6DropLowest(rng),
    dex: rollFourD6DropLowest(rng),
    health: rollFourD6DropLowest(rng),
    int: rollFourD6DropLowest(rng),
    lck: rollFourD6DropLowest(rng),
    pow: rollFourD6DropLowest(rng),
    siz: rollFourD6DropLowest(rng),
    str: rollFourD6DropLowest(rng),
    will: rollFourD6DropLowest(rng)
  } as const;

  const adjusted: GlantriCharacteristicBlock = {
    cha: raw.cha + getGlantriStatModifier(raw.com),
    com: raw.com,
    con: raw.con,
    dex: raw.dex + getDexteritySizeModifier(raw.siz),
    health: raw.health + getGlantriStatModifier(raw.con),
    int: raw.int,
    lck: raw.lck,
    pow: raw.pow,
    siz: raw.siz,
    str: raw.str + getGlantriStatModifier(raw.siz),
    will: raw.will
  };

  return Object.fromEntries(
    glantriCharacteristicOrder.map((key) => [key, adjusted[key]])
  ) as GlantriCharacteristicBlock;
}

function createRolledProfile(input: {
  id: string;
  label: string;
  rng: () => number;
  rolledStats: GlantriCharacteristicBlock;
  socialClassTableId: string;
}): RolledCharacterProfile {
  const socialClass = rollSocialClass({
    rng: input.rng,
    tableId: input.socialClassTableId
  });

  return {
    distractionLevel: rollDistractionLevel(input.rng),
    id: input.id,
    label: input.label,
    rolledStats: input.rolledStats,
    socialClassEducationValue: socialClass.educationValue,
    socialClassResult: socialClass.result,
    socialClassRoll: socialClass.roll,
    socialClassTableId: socialClass.tableId,
    societyLevel: 0
  };
}

export function generateProfiles(input: GenerateProfilesInput): RolledCharacterProfile[] {
  const rng = input.rng ?? Math.random;
  const socialClassTableId = input.socialClassTableId ?? DEFAULT_SOCIAL_CLASS_TABLE_ID;
  const rollSets =
    input.rollSets ??
    Array.from({ length: input.count ?? DEFAULT_PROFILE_COUNT }, () =>
      generateCharacteristicBlock(rng)
    );

  return rollSets.map((rolledStats, index) =>
    createRolledProfile({
      id: `profile-${index + 1}`,
      label: `Roll ${index + 1}`,
      rng,
      rolledStats,
      socialClassTableId
    })
  );
}
