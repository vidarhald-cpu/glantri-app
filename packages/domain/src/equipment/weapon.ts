import { z } from "zod";

import type {
  EquipmentItemFactsV1,
  WeaponAttackMode,
  WeaponDisarmCapability,
  WeaponDisarmGripClass,
  WeaponHandlingClass,
  WeaponTemplate,
} from "./types";
import { isItemMechanicalFactActive } from "./itemFacts";

export const weaponSchema = z.object({
  baseOb: z.number(),
  id: z.string(),
  name: z.string(),
});

export type Weapon = z.infer<typeof weaponSchema>;

export function isThrownWeaponAttackMode(
  mode: Pick<WeaponAttackMode, "attackType"> | undefined,
): boolean {
  return mode?.attackType === "thrown";
}

/** Same-source Double Attack is opt-in and restricted to an explicit melee thrust mode. */
export function canRepeatWeaponAttackInRound(
  mode: Pick<WeaponAttackMode, "allowsRepeatedRoundAttack" | "canonicalMeleeMode"> | undefined,
): boolean {
  return mode?.allowsRepeatedRoundAttack === true && mode.canonicalMeleeMode === "thrust";
}

export interface WeaponDisarmProfile {
  capability: WeaponDisarmCapability;
  controlRating: number;
  derivedControlRating: number;
  encumbranceTier: number;
  gripClass: WeaponDisarmGripClass;
  overrideSources: Array<"item_capability" | "item_control" | "template_control" | "template_grip">;
}

export function normalizeWeaponDisarmGripClass(
  handlingClass: WeaponHandlingClass,
  explicit?: WeaponDisarmGripClass | null,
): WeaponDisarmGripClass {
  if (explicit) return explicit;
  return handlingClass === "two_handed" || handlingClass === "polearm"
    ? "two_handed"
    : "one_handed";
}

export function deriveWeaponDisarmControlRating(input: {
  baseEncumbrance: number;
  gripClass: WeaponDisarmGripClass;
}): { controlRating: number; encumbranceTier: number } {
  if (!Number.isFinite(input.baseEncumbrance) || input.baseEncumbrance < 0) {
    throw new RangeError("Weapon base Encumbrance must be a non-negative number.");
  }
  const encumbranceTier = Math.max(1, Math.min(5, Math.ceil(input.baseEncumbrance / 3)));
  return {
    controlRating: encumbranceTier + (input.gripClass === "two_handed" ? 1 : 0),
    encumbranceTier,
  };
}

function validControlOverride(value: number | null | undefined): number | undefined {
  return Number.isInteger(value) && value! >= 1 && value! <= 6 ? value! : undefined;
}

/**
 * Resolves template defaults plus a concrete Item's typed differences. Weapon names are
 * deliberately absent from this function: content authorship owns default capability mapping.
 */
export function resolveWeaponDisarmProfile(input: {
  itemFacts?: EquipmentItemFactsV1 | null;
  template: Pick<
    WeaponTemplate,
    | "baseEncumbrance"
    | "disarmCapability"
    | "disarmControlOverride"
    | "disarmGripClass"
    | "handlingClass"
  >;
}): WeaponDisarmProfile {
  const gripClass = normalizeWeaponDisarmGripClass(
    input.template.handlingClass,
    input.template.disarmGripClass,
  );
  const derived = deriveWeaponDisarmControlRating({
    baseEncumbrance: input.template.baseEncumbrance,
    gripClass,
  });
  const capabilityOverride = [...(input.itemFacts?.templateOverrides ?? [])]
    .reverse()
    .find(
      (fact) =>
        fact.kind === "weapon_disarm_capability_override" && isItemMechanicalFactActive(fact),
    );
  const controlOverride = [...(input.itemFacts?.templateOverrides ?? [])]
    .reverse()
    .find(
      (fact) => fact.kind === "weapon_disarm_control_override" && isItemMechanicalFactActive(fact),
    );
  const templateControlOverride = validControlOverride(input.template.disarmControlOverride);
  const itemControlOverride =
    controlOverride?.kind === "weapon_disarm_control_override"
      ? validControlOverride(controlOverride.value)
      : undefined;
  const overrideSources: WeaponDisarmProfile["overrideSources"] = [];
  if (input.template.disarmGripClass) overrideSources.push("template_grip");
  if (templateControlOverride !== undefined) overrideSources.push("template_control");
  if (capabilityOverride?.kind === "weapon_disarm_capability_override") {
    overrideSources.push("item_capability");
  }
  if (itemControlOverride !== undefined) overrideSources.push("item_control");

  return {
    capability:
      capabilityOverride?.kind === "weapon_disarm_capability_override"
        ? capabilityOverride.value
        : (input.template.disarmCapability ?? "none"),
    controlRating: itemControlOverride ?? templateControlOverride ?? derived.controlRating,
    derivedControlRating: derived.controlRating,
    encumbranceTier: derived.encumbranceTier,
    gripClass,
    overrideSources,
  };
}

export function resolveWeaponDisarmMismatch(input: {
  actingControlRating: number;
  targetControlRating: number;
}): { feasible: boolean; gap: number; modifier: number } {
  if (
    !Number.isInteger(input.actingControlRating) ||
    !Number.isInteger(input.targetControlRating) ||
    input.actingControlRating < 1 ||
    input.targetControlRating < 1
  ) {
    throw new RangeError("Weapon-control ratings must be positive integers.");
  }
  const gap = Math.max(0, input.targetControlRating - input.actingControlRating);
  return { feasible: gap < 4, gap, modifier: gap === 0 ? 0 : -3 * gap };
}

export type PreferredAttackModeFailure = "no_legal_modes" | "selected_mode_invalid";

export interface AttackModeSelectionCandidate extends Pick<
  WeaponAttackMode,
  | "allowsRepeatedRoundAttack"
  | "attackType"
  | "canonicalMeleeMode"
  | "id"
  | "isPrimaryAttack"
  | "order"
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
  allowThrownAttack?: boolean;
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
      (mode.canonicalMeleeMode != null ||
        (input.allowThrownAttack && isThrownWeaponAttackMode(mode))) &&
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
