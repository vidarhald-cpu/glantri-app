import { weaponTemplates } from "@glantri/content";
import type { WeaponTemplate } from "@glantri/domain";

/**
 * Operational, GM-side diagnosis for the snapshot caveat recorded on Forgejo #411.
 *
 * `resolveDeclaredWeaponSource` resolves an attack from the **participant equipment snapshot**,
 * not from the live catalogue. A weapon template that was snapshotted before the `secondCrit`
 * enrichment carries no `Sec` code, so rule decision 0006's Secondary Critical chain fails closed
 * and silently under-fires for that participant.
 *
 * This module never repairs the snapshot, never mutates it, and never changes resolution. It only
 * compares the persisted snapshot template against the canonical catalogue and reports the gap so
 * an operator can diagnose it. The comparison has to live here rather than in
 * `packages/domain/src/encounter/**` because `packages/domain` may not import `packages/content`;
 * the API route is the lowest boundary at which both the snapshot and the catalogue are in hand.
 */

export const SNAPSHOT_SECONDARY_CRITICAL_WARNING_CODE = "snapshot_secondary_critical_code_missing";

export const SNAPSHOT_SECONDARY_CRITICAL_WARNING_MESSAGE =
  "The participant equipment snapshot lacks the canonical Secondary Critical `Sec` code for this attack mode; the Secondary Critical fails closed and under-fires for this participant.";

export type SnapshotSecondaryCriticalWarning = {
  attackModeId: string;
  canonicalSecondaryCriticalCode: string;
  code: typeof SNAPSHOT_SECONDARY_CRITICAL_WARNING_CODE;
  participantId: string;
  snapshotSecondaryCriticalCode: string | null;
  weaponName: string;
  weaponTemplateId: string;
};

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function findSnapshotAttackMode(input: {
  attackModeId: string;
  snapshotTemplatesById: Record<string, unknown> | undefined;
  weaponTemplateId: string;
}): Record<string, unknown> | undefined {
  const template = input.snapshotTemplatesById?.[input.weaponTemplateId];
  if (!isRecordValue(template)) return undefined;
  const attackModes = template["attackModes"];
  if (!Array.isArray(attackModes)) return undefined;
  return attackModes.find(
    (candidate): candidate is Record<string, unknown> =>
      isRecordValue(candidate) && candidate["id"] === input.attackModeId,
  );
}

/**
 * Returns a warning when the persisted snapshot template carries the attack mode but **not** the
 * `Sec` code the canonical catalogue authors for it. Returns `undefined` when the snapshot is
 * current, when the catalogue authors no `Sec` code for that mode (an authored absence is not a
 * gap), or when there is nothing to compare — a snapshot-only template has no canonical code, so
 * the check fails closed rather than guessing.
 */
export function detectSnapshotSecondaryCriticalCodeGap(input: {
  attackModeId: string;
  canonicalTemplates?: readonly WeaponTemplate[];
  participantId: string;
  snapshotTemplatesById: Record<string, unknown> | undefined;
  weaponName: string;
  weaponTemplateId: string | undefined;
}): SnapshotSecondaryCriticalWarning | undefined {
  const weaponTemplateId = input.weaponTemplateId;
  if (!weaponTemplateId) return undefined;
  const canonicalTemplate = (input.canonicalTemplates ?? weaponTemplates).find(
    (candidate) => candidate.id === weaponTemplateId,
  );
  const canonicalMode = canonicalTemplate?.attackModes?.find(
    (candidate) => candidate.id === input.attackModeId,
  );
  const canonicalSecondaryCriticalCode = readNonEmptyString(canonicalMode?.secondCrit);
  if (!canonicalSecondaryCriticalCode) return undefined;

  const snapshotMode = findSnapshotAttackMode({
    attackModeId: input.attackModeId,
    snapshotTemplatesById: input.snapshotTemplatesById,
    weaponTemplateId,
  });
  if (!snapshotMode) return undefined;

  const snapshotSecondaryCriticalCodeValue = snapshotMode["secondCrit"];
  if (readNonEmptyString(snapshotSecondaryCriticalCodeValue)) return undefined;

  return {
    attackModeId: input.attackModeId,
    canonicalSecondaryCriticalCode,
    code: SNAPSHOT_SECONDARY_CRITICAL_WARNING_CODE,
    participantId: input.participantId,
    snapshotSecondaryCriticalCode:
      typeof snapshotSecondaryCriticalCodeValue === "string"
        ? snapshotSecondaryCriticalCodeValue
        : null,
    weaponName: input.weaponName,
    weaponTemplateId,
  };
}
