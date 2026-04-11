import type { GlantriCharacteristicBlock, GlantriCharacteristicKey } from "@glantri/domain";

const STAT_MODIFIER_TABLE = [
  -5,
  -4,
  -4,
  -3,
  -3,
  -2,
  -2,
  -1,
  -1,
  0,
  0,
  0,
  1,
  1,
  2,
  2,
  3,
  3,
  4,
  4,
  5,
  5,
  6,
  6,
  7
] as const;

export function getGlantriStatModifier(value: number): number {
  return STAT_MODIFIER_TABLE[value - 1] ?? 0;
}

export function getDexteritySizeModifier(siz: number): number {
  const sizeGm = getGlantriStatModifier(siz);

  if (siz > 14) {
    return -(sizeGm - 1);
  }

  if (siz > 9) {
    return 0;
  }

  return -sizeGm;
}

export function getWorkbookCharacterSheetGm(value: number): number {
  return Math.trunc((value - 11) / 2);
}

export function getCharacteristicGm(
  _stat: GlantriCharacteristicKey,
  stats: GlantriCharacteristicBlock
): number {
  return getWorkbookCharacterSheetGm(stats[_stat]);
}
