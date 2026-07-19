import { z } from "zod";

import type { WeaponAttackMode } from "./types";

export const weaponSchema = z.object({
  baseOb: z.number(),
  id: z.string(),
  name: z.string()
});

export type Weapon = z.infer<typeof weaponSchema>;

/** Same-source Double Attack is opt-in and restricted to an explicit melee thrust mode. */
export function canRepeatWeaponAttackInRound(
  mode: Pick<WeaponAttackMode, "allowsRepeatedRoundAttack" | "canonicalMeleeMode"> | undefined,
): boolean {
  return mode?.allowsRepeatedRoundAttack === true && mode.canonicalMeleeMode === "thrust";
}

export type PreferredAttackModeFailure = "no_legal_modes" | "selected_mode_invalid";

export interface AttackModeSelectionCandidate
  extends Pick<
    WeaponAttackMode,
    "allowsRepeatedRoundAttack" | "canonicalMeleeMode" | "id" | "isPrimaryAttack" | "order"
  > {}

export interface PreferredAttackModeResolution<TMode extends AttackModeSelectionCandidate> {
  legalModes: TMode[];
  mode?: TMode;
  reason?: PreferredAttackModeFailure;
  usedFallback: boolean;
}

/**
 * Resolves a mode before declaration commitment. Explicit selections win while legal,
 * followed by the explicit main mode and canonical mode order. Committed opportunities
 * store the returned mode id and never call this resolver during replay.
 */
export function resolvePreferredAttackMode<TMode extends AttackModeSelectionCandidate>(input: {
  requireRepeatedRoundAttack?: boolean;
  selectedModeId?: string;
  weapon: { attackModes?: readonly TMode[] | null };
}): PreferredAttackModeResolution<TMode> {
  const orderedModes = (input.weapon.attackModes ?? [])
    .map((mode, index) => ({ index, mode }))
    .sort(
      (left, right) =>
        (left.mode.order ?? left.index) - (right.mode.order ?? right.index) ||
        left.index - right.index,
    )
    .map(({ mode }) => mode);
  const legalModes = orderedModes.filter(
    (mode) =>
      mode.canonicalMeleeMode != null &&
      (!input.requireRepeatedRoundAttack || canRepeatWeaponAttackInRound(mode)),
  );

  if (legalModes.length === 0) {
    return { legalModes, reason: "no_legal_modes", usedFallback: false };
  }

  if (input.selectedModeId) {
    const selected = legalModes.find((mode) => mode.id === input.selectedModeId);
    if (selected) {
      return { legalModes, mode: selected, usedFallback: false };
    }
  }

  const mainMode = legalModes.find((mode) => mode.isPrimaryAttack === true);
  return {
    legalModes,
    mode: mainMode ?? legalModes[0],
    reason: input.selectedModeId ? "selected_mode_invalid" : undefined,
    usedFallback: Boolean(input.selectedModeId),
  };
}
