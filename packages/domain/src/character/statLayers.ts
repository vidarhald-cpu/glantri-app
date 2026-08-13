import type { CharacterBuild } from "./build";
import {
  glantriCharacteristicOrder,
  type GlantriCharacteristicBlock,
  type GlantriCharacteristicKey,
} from "./profiles";

export const CHARACTER_STAT_LAYER_VERSION = 1 as const;

export interface CharacterStatLayers {
  compatibility: "canonical" | "legacy-unknown-base";
  current: GlantriCharacteristicBlock;
  developed: GlantriCharacteristicBlock;
  original: GlantriCharacteristicBlock;
  rolledOrBase?: GlantriCharacteristicBlock;
}

function applyModifiers(
  stats: GlantriCharacteristicBlock,
  ...modifiers: Array<Record<string, number> | undefined>
): GlantriCharacteristicBlock {
  return Object.fromEntries(
    glantriCharacteristicOrder.map((stat) => [
      stat,
      modifiers.reduce((value, modifier) => value + (modifier?.[stat] ?? 0), stats[stat]),
    ]),
  ) as GlantriCharacteristicBlock;
}

/**
 * Returns the one canonical Character characteristic read model.
 *
 * Rolled/Base is only exposed when the record explicitly carries canonical
 * layer provenance. Older records keep their stored gameplay values, but an
 * unavailable raw roll is never inferred from an ambiguous legacy field.
 */
export function deriveCharacterStatLayers(
  build: Pick<
    CharacterBuild,
    "currentStatModifiers" | "developedStatModifiers" | "profile" | "statModifiers"
  >,
  additionalCurrentModifiers?: Record<string, number>,
): CharacterStatLayers {
  const original = { ...(build.profile.resolvedStats ?? build.profile.rolledStats) };
  const developed = applyModifiers(original, build.developedStatModifiers);
  const current = applyModifiers(
    developed,
    build.statModifiers,
    build.currentStatModifiers,
    additionalCurrentModifiers,
  );
  const canonical = build.profile.statLayerVersion === CHARACTER_STAT_LAYER_VERSION;

  return {
    compatibility: canonical ? "canonical" : "legacy-unknown-base",
    current,
    developed,
    original,
    rolledOrBase: canonical ? { ...build.profile.rolledStats } : undefined,
  };
}

export function getCharacterCurrentStat(
  build: Pick<
    CharacterBuild,
    "currentStatModifiers" | "developedStatModifiers" | "profile" | "statModifiers"
  >,
  stat: GlantriCharacteristicKey,
): number {
  return deriveCharacterStatLayers(build).current[stat];
}
