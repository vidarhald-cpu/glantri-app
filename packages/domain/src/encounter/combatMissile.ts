import { z } from "zod";

import {
  MissileAmmoFamilySchema,
  MissileWeaponFamilySchema,
  MissileWeaponProfileSchema,
} from "../equipment/schemas";

const idSchema = z.string().min(1);

export const combatMissileAimLevelSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);
export type CombatMissileAimLevel = z.infer<typeof combatMissileAimLevelSchema>;

export const COMBAT_MISSILE_AIM = Object.freeze({
  0: Object.freeze({ attackModifier: 0, extraRounds: 0 }),
  1: Object.freeze({ attackModifier: 1, extraRounds: 2 }),
  2: Object.freeze({ attackModifier: 2, extraRounds: 4 }),
  3: Object.freeze({ attackModifier: 3, extraRounds: 6 }),
} satisfies Record<CombatMissileAimLevel, { attackModifier: number; extraRounds: number }>);

export const combatMissileReadinessSchema = z.object({
  aimCompletedRounds: z.number().int().nonnegative().default(0),
  aimRequiredRounds: z.number().int().nonnegative().optional(),
  aimLevel: combatMissileAimLevelSchema.default(0),
  ammoFamily: MissileAmmoFamilySchema,
  ammoItemId: idSchema.optional(),
  ammoItemRevision: idSchema.optional(),
  baseCompletedRounds: z.number().int().nonnegative().default(0),
  baseRequiredRounds: z.number().int().nonnegative().optional(),
  family: MissileWeaponFamilySchema,
  gmPreparationAdjustment: z.number().int().default(0),
  id: idSchema,
  lastCommandId: idSchema.optional(),
  lastProgressRound: z.number().int().positive().optional(),
  participantId: idSchema,
  phase: z.enum(["phase1", "phase2"]).optional(),
  profile: MissileWeaponProfileSchema,
  rapidShot: z.boolean().default(false),
  status: z.enum(["idle", "preparing", "spanned", "loaded", "ready"]).default("idle"),
  targetParticipantId: idSchema.optional(),
  updatedAt: z.string().datetime(),
  weaponItemId: idSchema,
  weaponTemplateId: idSchema,
});
export type CombatMissileReadiness = z.infer<typeof combatMissileReadinessSchema>;

export const combatMissileReadinessIntentSchema = z.object({
  aimLevel: combatMissileAimLevelSchema.default(0),
  ammoItemId: idSchema,
  ammoItemRevision: idSchema,
  gmPreparationAdjustment: z.number().int().min(-9).max(20).default(0),
  rapidShot: z.boolean().default(false),
  targetParticipantId: idSchema,
});
export type CombatMissileReadinessIntent = z.infer<typeof combatMissileReadinessIntentSchema>;

export function buildCombatMissileReadinessId(input: {
  participantId: string;
  weaponItemId: string;
}): string {
  return `missile-readiness:${input.participantId}:${input.weaponItemId}`;
}

export function getCombatMissileRequiredRounds(input: {
  aimLevel: CombatMissileAimLevel;
  gmPreparationAdjustment: number;
  profile: z.infer<typeof MissileWeaponProfileSchema>;
  rapidShot: boolean;
}): { aimRounds: number; baseRounds: number; totalRounds: number } {
  if (input.rapidShot && !input.profile.rapidShotAllowed) {
    throw new RangeError("This weapon cannot use Rapid shot to bypass preparation.");
  }
  const baseRounds = input.rapidShot
    ? 0
    : Math.max(0, input.profile.standardPreparationRounds + input.gmPreparationAdjustment);
  const aimRounds = COMBAT_MISSILE_AIM[input.aimLevel].extraRounds;
  return { aimRounds, baseRounds, totalRounds: baseRounds + aimRounds };
}

export function getCombatMissileAttackModifier(readiness: CombatMissileReadiness): number {
  return COMBAT_MISSILE_AIM[readiness.aimLevel].attackModifier + (readiness.rapidShot ? -4 : 0);
}

function statusForProgress(input: {
  baseCompletedRounds: number;
  baseRounds: number;
  profile: z.infer<typeof MissileWeaponProfileSchema>;
  ready: boolean;
}): CombatMissileReadiness["status"] {
  if (input.ready) return input.profile.canRemainReady ? "loaded" : "ready";
  if (
    input.profile.preparationModel === "staged_persistent" &&
    input.baseCompletedRounds >= input.baseRounds
  ) {
    return "loaded";
  }
  if (
    input.profile.preparationModel === "staged_persistent" &&
    input.baseRounds > 0 &&
    input.baseCompletedRounds >= Math.max(1, input.baseRounds - 1)
  ) {
    return "spanned";
  }
  return input.baseCompletedRounds > 0 ? "preparing" : "idle";
}

export function isCombatMissileReady(readiness: CombatMissileReadiness): boolean {
  const calculated = getCombatMissileRequiredRounds(readiness);
  const required = {
    aimRounds: readiness.aimRequiredRounds ?? calculated.aimRounds,
    baseRounds: readiness.baseRequiredRounds ?? calculated.baseRounds,
  };
  return (
    readiness.baseCompletedRounds >= required.baseRounds &&
    readiness.aimCompletedRounds >= required.aimRounds &&
    (readiness.status === "ready" || readiness.status === "loaded")
  );
}

export function advanceCombatMissileReadiness(input: {
  commandId: string;
  current?: CombatMissileReadiness;
  intent: CombatMissileReadinessIntent;
  participantId: string;
  phase: "phase1" | "phase2";
  profile: z.infer<typeof MissileWeaponProfileSchema>;
  roundNumber: number;
  submittedAt: string;
  weaponItemId: string;
  weaponTemplateId: string;
}): CombatMissileReadiness {
  const intent = combatMissileReadinessIntentSchema.parse(input.intent);
  const required = getCombatMissileRequiredRounds({ ...intent, profile: input.profile });
  const currentRequired = input.current ? getCombatMissileRequiredRounds(input.current) : undefined;
  const currentBaseRequired = input.current?.baseRequiredRounds ?? currentRequired?.baseRounds;
  const retainsLoadedPersistentStage =
    input.current?.weaponItemId === input.weaponItemId &&
    input.current.profile.family === input.profile.family &&
    input.current.profile.preparationModel === "staged_persistent" &&
    input.current.status === "loaded" &&
    currentBaseRequired !== undefined &&
    input.current.baseCompletedRounds >= currentBaseRequired;
  const samePhysicalPreparation =
    input.current?.weaponItemId === input.weaponItemId &&
    input.current.profile.family === input.profile.family &&
    input.current.gmPreparationAdjustment === intent.gmPreparationAdjustment &&
    input.current.rapidShot === intent.rapidShot;
  const sameAim =
    samePhysicalPreparation &&
    input.current?.aimLevel === intent.aimLevel &&
    input.current.targetParticipantId === intent.targetParticipantId;
  let baseCompletedRounds = retainsLoadedPersistentStage
    ? required.baseRounds
    : samePhysicalPreparation
      ? Math.min(input.current?.baseCompletedRounds ?? 0, required.baseRounds)
      : 0;
  let aimCompletedRounds = sameAim
    ? Math.min(input.current?.aimCompletedRounds ?? 0, required.aimRounds)
    : 0;

  if (baseCompletedRounds < required.baseRounds) baseCompletedRounds += 1;
  else if (aimCompletedRounds < required.aimRounds) aimCompletedRounds += 1;

  const ready =
    baseCompletedRounds >= required.baseRounds && aimCompletedRounds >= required.aimRounds;
  return combatMissileReadinessSchema.parse({
    aimCompletedRounds,
    aimLevel: intent.aimLevel,
    aimRequiredRounds: required.aimRounds,
    ammoFamily: input.profile.ammoFamily,
    ammoItemId: intent.ammoItemId,
    ammoItemRevision: intent.ammoItemRevision,
    baseCompletedRounds,
    baseRequiredRounds: required.baseRounds,
    family: input.profile.family,
    gmPreparationAdjustment: intent.gmPreparationAdjustment,
    id: buildCombatMissileReadinessId(input),
    lastCommandId: input.commandId,
    lastProgressRound: input.roundNumber,
    participantId: input.participantId,
    phase: input.phase,
    profile: input.profile,
    rapidShot: intent.rapidShot,
    status: statusForProgress({
      baseCompletedRounds,
      baseRounds: required.baseRounds,
      profile: input.profile,
      ready,
    }),
    targetParticipantId: intent.targetParticipantId,
    updatedAt: input.submittedAt,
    weaponItemId: input.weaponItemId,
    weaponTemplateId: input.weaponTemplateId,
  });
}

export function interruptCombatMissileReadiness(input: {
  current: CombatMissileReadiness;
  interruptedAt: string;
}): CombatMissileReadiness {
  const current = combatMissileReadinessSchema.parse(input.current);
  const persistent = current.profile.preparationModel === "staged_persistent";
  const required = getCombatMissileRequiredRounds(current);
  const interruptedRequired = getCombatMissileRequiredRounds({
    ...current,
    aimLevel: 0,
    gmPreparationAdjustment: 0,
    rapidShot: false,
  });
  const loadedBase = required.baseRounds;
  const spannedBase = Math.max(1, required.baseRounds - 1);
  const durableBase = !persistent
    ? 0
    : current.baseCompletedRounds >= loadedBase
      ? loadedBase
      : current.baseCompletedRounds >= spannedBase
        ? spannedBase
        : 0;
  return combatMissileReadinessSchema.parse({
    ...current,
    aimCompletedRounds: 0,
    aimLevel: 0,
    aimRequiredRounds: interruptedRequired.aimRounds,
    baseCompletedRounds: durableBase,
    baseRequiredRounds: durableBase > 0 ? required.baseRounds : interruptedRequired.baseRounds,
    gmPreparationAdjustment: 0,
    rapidShot: false,
    status:
      persistent && durableBase >= loadedBase ? "loaded" : durableBase > 0 ? "spanned" : "idle",
    targetParticipantId: undefined,
    updatedAt: input.interruptedAt,
  });
}

/**
 * Returns whether interruption would invalidate any banked preparation or targeting choice.
 * Timestamps are intentionally ignored so accepted no-op actions cannot manufacture repeat
 * interruption commands.
 */
export function canInterruptCombatMissileReadiness(readiness: CombatMissileReadiness): boolean {
  const current = combatMissileReadinessSchema.parse(readiness);
  const interrupted = interruptCombatMissileReadiness({
    current,
    interruptedAt: current.updatedAt,
  });
  return (
    current.aimCompletedRounds !== interrupted.aimCompletedRounds ||
    current.aimLevel !== interrupted.aimLevel ||
    current.aimRequiredRounds !== interrupted.aimRequiredRounds ||
    current.baseCompletedRounds !== interrupted.baseCompletedRounds ||
    current.baseRequiredRounds !== interrupted.baseRequiredRounds ||
    current.gmPreparationAdjustment !== interrupted.gmPreparationAdjustment ||
    current.rapidShot !== interrupted.rapidShot ||
    current.status !== interrupted.status ||
    current.targetParticipantId !== interrupted.targetParticipantId
  );
}

export function consumeCombatMissileReadinessAfterShot(input: {
  current: CombatMissileReadiness;
  firedAt: string;
}): CombatMissileReadiness {
  if (!isCombatMissileReady(input.current)) throw new RangeError("Missile weapon is not ready.");
  return combatMissileReadinessSchema.parse({
    ...input.current,
    aimCompletedRounds: 0,
    aimLevel: 0,
    baseCompletedRounds: 0,
    baseRequiredRounds: input.current.profile.standardPreparationRounds,
    gmPreparationAdjustment: 0,
    lastCommandId: undefined,
    rapidShot: false,
    status: "idle",
    targetParticipantId: undefined,
    aimRequiredRounds: 0,
    updatedAt: input.firedAt,
  });
}

export function isCompatibleMissileAmmunition(input: {
  ammoFamily?: string | null;
  profile: z.infer<typeof MissileWeaponProfileSchema>;
}): boolean {
  return input.ammoFamily === input.profile.ammoFamily;
}
