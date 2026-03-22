import type {
  GlantriCharacteristicKey,
  RolledCharacterProfile
} from "@glantri/domain";

import {
  glantriCharacteristicLabels,
  glantriCharacteristicOrder
} from "@glantri/domain";

export interface RolledProfileCharacteristicSummary {
  key: string;
  label: string;
  value: number;
}

export interface RolledProfileSummary {
  characteristics: RolledProfileCharacteristicSummary[];
  distractionLevel: number;
  socialClassResult?: string;
  totalCharacteristicSum: number;
}

function getCharacteristicKeys(
  profile: RolledCharacterProfile
): GlantriCharacteristicKey[] {
  return glantriCharacteristicOrder.filter((key) => key in profile.rolledStats);
}

function getCharacteristicLabel(key: string): string {
  return glantriCharacteristicLabels[key as keyof typeof glantriCharacteristicLabels] ?? key.toUpperCase();
}

export function summarizeRolledProfile(input: {
  profile: RolledCharacterProfile;
  socialClassResult?: string;
}): RolledProfileSummary {
  const characteristics = getCharacteristicKeys(input.profile).map((key) => ({
    key,
    label: getCharacteristicLabel(key),
    value: input.profile.rolledStats[key]
  }));

  return {
    characteristics,
    distractionLevel: input.profile.distractionLevel,
    socialClassResult: input.profile.socialClassResult ?? input.socialClassResult,
    totalCharacteristicSum: characteristics.reduce((sum, characteristic) => sum + characteristic.value, 0)
  };
}
