import {
  catalogueIntegrityKey,
  deriveCharacterStatLayers,
  getCharacterSkillKey,
  glantriCharacteristicOrder,
} from "@glantri/domain";
import type {
  CharacterBuild,
  CharacterProgression,
  CharacterProgressionState,
  ProgressionTargetType,
} from "@glantri/domain";

import {
  applySuccessfulProgressionIncrease,
  getCharacterProgressionState,
  getProgressionAttemptCost,
} from "../advancement/advanceCharacter";
import type { CanonicalContentShape } from "./primaryAllocation/_helpers";
import { findDerivedRelationshipGrantErrors } from "./validateTargetChargenBuild";

/**
 * Forgejo #1068 (WO-1068-S1). Every save of a Character after Chargen finalization.
 *
 * Chargen finalization keeps `validateTargetChargenBuild` unchanged. After Chargen the Product
 * Owner's rulings (Forgejo #1068 comments 24480 and 24529) apply instead:
 *
 * 1. GM edits are bound only by the basic rules: whole numbers, stats 1–25, Distraction 2–6,
 *    ranks at least 0. No Chargen point limit, Profession access or prerequisite applies.
 * 2. The Chargen spending totals are frozen: "Original" skill points never change after Chargen.
 * 3. Original stats are locked after Chargen; permanent change is Developed, temporary is Current.
 * 6. Only a GM or admin may type values. Any other writer may change a stat or a skill value
 *    only through resolved Progression backed by a GM-approved check, and may not change the
 *    civilization, society, social class or Profession those values derive from.
 *
 * Structural integrity still holds for target Characters: every competency id exists in the
 * approved target catalogue, saved definitions are intact, there are no duplicates, rank totals
 * are consistent, and derived relationship grants are recomputed rather than trusted.
 */
export interface ValidatePostChargenBuildInput {
  build: CharacterBuild;
  content: CanonicalContentShape;
  /**
   * True only when the writer is a GM or admin. False refuses any direct change of a stat or a
   * skill value that resolved Progression does not explain (ruling 6).
   */
  directValueEdit: boolean;
  /** The stored record this save replaces. Absent when there is no stored record to compare. */
  storedBuild?: CharacterBuild;
}

export const OWNER_DIRECT_VALUE_CHANGE_MESSAGE =
  "Only a GM or admin can change stats or skill values directly; players improve through resolved Progression.";

export const OWNER_IDENTITY_CHANGE_MESSAGE =
  "Only a GM or admin can change a Character's civilization, society, social class or Profession after Chargen.";

/** Structural equality for JSON-shaped build data; key order is irrelevant. */
function isDeepStrictEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (typeof left !== "object" || typeof right !== "object" || left === null || right === null)
    return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).filter((key) => leftRecord[key] !== undefined);
  const rightKeys = Object.keys(rightRecord).filter((key) => rightRecord[key] !== undefined);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key) => isDeepStrictEqual(leftRecord[key], rightRecord[key]))
  );
}

const STAT_MIN = 1;
const STAT_MAX = 25;
const DISTRACTION_MIN = 2;
const DISTRACTION_MAX = 6;
const MOTHER_TONGUE_SKILL_ID = "language";

function isTargetBuild(build: CharacterBuild, content: CanonicalContentShape): boolean {
  return Boolean(
    build.targetChargen ||
    build.professionId?.startsWith("profession:") ||
    build.progression.skillGroups.some((g) =>
      content.chargenCatalogue?.groupIds?.includes(g.groupId),
    ),
  );
}

function findStatErrors(build: CharacterBuild, storedBuild?: CharacterBuild): string[] {
  const errors: string[] = [];
  if (
    storedBuild &&
    (!isDeepStrictEqual(build.profile.rolledStats, storedBuild.profile.rolledStats) ||
      !isDeepStrictEqual(build.profile.resolvedStats, storedBuild.profile.resolvedStats))
  )
    errors.push("Original stats are locked after Chargen.");
  const layers = deriveCharacterStatLayers(build);
  const storedLayers = storedBuild ? deriveCharacterStatLayers(storedBuild) : undefined;
  for (const stat of glantriCharacteristicOrder) {
    for (const layer of ["developed", "current"] as const) {
      const value = layers[layer][stat];
      if (storedLayers && storedLayers[layer][stat] === value) continue;
      if (!Number.isInteger(value) || value < STAT_MIN || value > STAT_MAX)
        errors.push(`Stat ${stat} must be a whole number from ${STAT_MIN} to ${STAT_MAX}.`);
    }
  }
  const distraction = build.profile.distractionLevel;
  if (
    distraction !== storedBuild?.profile.distractionLevel &&
    (distraction < DISTRACTION_MIN || distraction > DISTRACTION_MAX)
  )
    errors.push(
      `Distraction must be a whole number from ${DISTRACTION_MIN} to ${DISTRACTION_MAX}.`,
    );
  return [...new Set(errors)];
}

function findTargetStructureErrors(
  build: CharacterBuild,
  content: CanonicalContentShape,
): string[] {
  const errors: string[] = [];
  // The server re-derives the saved Profession metadata from this id, so it must stay real.
  if (!content.professions.some((profession) => profession.id === build.professionId))
    errors.push("Unknown target Profession or track.");
  const catalogue = content.chargenCatalogue;
  const p = build.progression;
  for (const group of p.skillGroups) {
    if (!catalogue?.groupIds?.includes(group.groupId)) {
      errors.push(`Unknown target Learning Group ${group.groupId}.`);
      continue;
    }
    const approved = content.skillGroups.find((g) => g.id === group.groupId);
    if (
      group.targetDefinition &&
      (!approved ||
        catalogueIntegrityKey(group.targetDefinition) !== catalogueIntegrityKey(approved))
    )
      errors.push(`Forged Learning Group metadata: ${group.groupId}.`);
    if (group.ranks !== group.grantedRanks + group.primaryRanks + group.secondaryRanks)
      errors.push(`Inconsistent Learning Group ranks: ${group.groupId}.`);
  }
  for (const skill of p.skills) {
    const motherTongue =
      skill.skillId === MOTHER_TONGUE_SKILL_ID && skill.sourceTag === "mother-tongue";
    if (!motherTongue && !catalogue?.skillIds.includes(skill.skillId)) {
      errors.push(`Unknown target competency ${skill.skillId}.`);
      continue;
    }
    if (!motherTongue && !skill.targetDefinition)
      errors.push(`Missing target definition: ${skill.skillId}.`);
    if (
      skill.ranks !==
      skill.grantedRanks +
        skill.primaryRanks +
        skill.secondaryRanks +
        (skill.relationshipGrantedRanks ?? 0)
    )
      errors.push(`Inconsistent competency ranks: ${skill.skillId}.`);
  }
  for (const spec of p.specializations) {
    if (!catalogue?.specializationIds.includes(spec.specializationId)) {
      errors.push(`Unknown target Specialization ${spec.specializationId}.`);
      continue;
    }
    if (!spec.targetDefinition) errors.push(`Missing target definition: ${spec.specializationId}.`);
    if (spec.ranks !== spec.secondaryRanks + (spec.relationshipGrantedRanks ?? 0))
      errors.push(`Inconsistent Specialization ranks: ${spec.specializationId}.`);
  }
  if (
    new Set(p.skillGroups.map((g) => g.groupId)).size !== p.skillGroups.length ||
    new Set(p.skills.map((s) => s.skillId)).size !== p.skills.length ||
    new Set(p.specializations.map((s) => s.specializationId)).size !== p.specializations.length
  )
    errors.push("Duplicate target purchase identity.");
  if (errors.length === 0)
    errors.push(...findDerivedRelationshipGrantErrors(p, content, { keepGrantedRanks: true }));
  return errors;
}

const FROZEN_CHARGEN_TOTALS = [
  "primaryPoolSpent",
  "primaryPoolTotal",
  "secondaryPoolSpent",
  "secondaryPoolTotal",
] as const;

function findFrozenTotalErrors(build: CharacterBuild, storedBuild: CharacterBuild): string[] {
  return FROZEN_CHARGEN_TOTALS.some(
    (key) => build.progression[key] !== storedBuild.progression[key],
  )
    ? ["The Chargen skill-point totals cannot change after Chargen."]
    : [];
}

/** The owned value of every competency row, ignoring derived grants and attribution. */
function rankSignature(progression: CharacterProgression): Record<string, number> {
  const signature: Record<string, number> = {};
  const put = (key: string, value: number) => {
    if (value !== 0) signature[key] = value;
  };
  for (const group of progression.skillGroups) {
    put(`group:${group.groupId}:granted`, group.grantedRanks);
    put(`group:${group.groupId}:primary`, group.primaryRanks);
    put(`group:${group.groupId}:secondary`, group.secondaryRanks);
    put(`group:${group.groupId}:gms`, group.gms ?? 0);
  }
  for (const skill of progression.skills) {
    const key = `skill:${getCharacterSkillKey(skill)}`;
    put(`${key}:granted`, skill.grantedRanks);
    put(`${key}:primary`, skill.primaryRanks);
    put(`${key}:secondary`, skill.secondaryRanks);
  }
  for (const spec of progression.specializations) {
    put(`specialization:${spec.specializationId}:secondary`, spec.secondaryRanks);
  }
  return signature;
}

function statSignature(build: CharacterBuild) {
  const layers = deriveCharacterStatLayers(build);
  return {
    current: layers.current,
    developed: layers.developed,
    distraction: build.profile.distractionLevel,
    original: layers.original,
    rolled: build.profile.rolledStats,
  };
}

/**
 * The Chargen identity a Character's skill values are derived from (ruling 6, #1068 QA findings
 * A3 and B1). Civilization sets the mother tongue, social class sets its education grant, and the
 * Profession sets the Progression prices and target metadata, so changing any of them changes
 * skill values or what improving them costs without any resolved Progression. The target
 * metadata digests are left out: the server re-derives them from the Profession on every save.
 */
function identitySignature(build: CharacterBuild) {
  return {
    civilizationId: build.civilizationId,
    professionId: build.professionId,
    socialClass: build.socialClass,
    socialClassEducationValue: build.profile.socialClassEducationValue,
    socialClassResult: build.profile.socialClassResult,
    socialClassRoll: build.profile.socialClassRoll,
    socialClassTableId: build.profile.socialClassTableId,
    societyId: build.societyId,
    societyLevel: build.societyLevel,
    profileSocietyLevel: build.profile.societyLevel,
    targetChargen: build.targetChargen
      ? {
          familyId: build.targetChargen.familyId,
          professionName: build.targetChargen.professionName,
          trackId: build.targetChargen.trackId,
        }
      : undefined,
  };
}

function findOwnerIdentityErrors(build: CharacterBuild, storedBuild: CharacterBuild): string[] {
  return isDeepStrictEqual(identitySignature(build), identitySignature(storedBuild))
    ? []
    : [OWNER_IDENTITY_CHANGE_MESSAGE];
}

function sameTarget(
  left: { targetId: string; targetType: ProgressionTargetType },
  right: { targetId: string; targetType: ProgressionTargetType },
): boolean {
  return left.targetId === right.targetId && left.targetType === right.targetType;
}

function sumCost(entries: ReadonlyArray<{ cost: number }>): number {
  return entries.reduce((total, entry) => total + entry.cost, 0);
}

/**
 * Ruling 6. A writer who is not a GM or admin may change progression state only the way the
 * Progression page does: request checks, buy attempts against GM-approved checks with points the
 * GM granted, and resolve them. A stat or skill value may change only by the successful
 * attempts this save resolves, each replayed here through the same increase Progression applies.
 */
function findOwnerDirectValueErrors(input: {
  build: CharacterBuild;
  content: CanonicalContentShape;
  storedBuild: CharacterBuild;
}): string[] {
  const refusal = [OWNER_DIRECT_VALUE_CHANGE_MESSAGE];
  if (!isDeepStrictEqual(statSignature(input.build), statSignature(input.storedBuild)))
    return refusal;

  const stored: CharacterProgressionState = getCharacterProgressionState(input.storedBuild);
  const next: CharacterProgressionState = getCharacterProgressionState(input.build);

  // Recorded history is permanent, and only a GM approves a check.
  const nextHistoryById = new Map(next.history.map((entry) => [entry.id, entry]));
  if (stored.history.some((entry) => !isDeepStrictEqual(nextHistoryById.get(entry.id), entry)))
    return refusal;
  const storedApproved = stored.checks.filter(
    (check) => (check.status ?? "approved") === "approved",
  );
  for (const check of next.checks) {
    if ((check.status ?? "approved") !== "approved") continue;
    const approved = storedApproved.find((candidate) => candidate.id === check.id);
    if (!approved || !sameTarget(approved, check)) return refusal;
  }

  // Every new attempt and every newly resolved entry spends a GM-approved check from the stored
  // record at the price the stored record sets.
  const storedHistoryIds = new Set(stored.history.map((entry) => entry.id));
  const resolved = next.history.filter((entry) => !storedHistoryIds.has(entry.id));
  const storedPendingIds = new Set(stored.pendingAttempts.map((attempt) => attempt.id));
  const newAttempts = next.pendingAttempts.filter((attempt) => !storedPendingIds.has(attempt.id));
  const spent = new Set<string>();
  const priceOf = (target: { targetId: string; targetType: ProgressionTargetType }) =>
    getProgressionAttemptCost({
      build: input.storedBuild,
      content: input.content,
      targetId: target.targetId,
      targetType: target.targetType,
    }).cost;
  const priceIsAuthoritative = isTargetBuild(input.storedBuild, input.content);
  const claim = (entry: { targetId: string; targetType: ProgressionTargetType }) => {
    const key = `${entry.targetType}:${entry.targetId}`;
    if (spent.has(key)) return false;
    spent.add(key);
    return true;
  };
  const isApprovedPurchase = (entry: {
    cost: number;
    targetId: string;
    targetType: ProgressionTargetType;
  }) =>
    storedApproved.some((check) => sameTarget(check, entry)) &&
    (!priceIsAuthoritative || entry.cost === priceOf(entry));
  for (const attempt of newAttempts) {
    if (!claim(attempt) || !isApprovedPurchase(attempt)) return refusal;
  }
  for (const entry of resolved) {
    if (!claim(entry)) return refusal;
    const storedAttempt = stored.pendingAttempts.find((attempt) => sameTarget(attempt, entry));
    if (storedAttempt ? entry.cost !== storedAttempt.cost : !isApprovedPurchase(entry))
      return refusal;
  }
  // Points move from available to pending to history; none are created.
  if (
    next.availablePoints + sumCost(next.pendingAttempts) + sumCost(resolved) !==
    stored.availablePoints + sumCost(stored.pendingAttempts)
  )
    return refusal;

  // The skill values are exactly the stored values plus the resolved successes.
  let expected = input.storedBuild;
  for (const entry of resolved) {
    if (!entry.success) continue;
    expected = applySuccessfulProgressionIncrease({
      build: expected,
      content: input.content,
      targetId: entry.targetId,
      targetType: entry.targetType,
    });
  }
  if (
    !isDeepStrictEqual(rankSignature(input.build.progression), rankSignature(expected.progression))
  )
    return refusal;
  return [];
}

export function validatePostChargenBuild(input: ValidatePostChargenBuildInput): string[] {
  const { build, content, storedBuild } = input;
  const errors: string[] = [];
  if (storedBuild && !input.directValueEdit) {
    errors.push(...findOwnerIdentityErrors(build, storedBuild));
    errors.push(...findOwnerDirectValueErrors({ build, content, storedBuild }));
  }
  if (!isTargetBuild(build, content) && !(storedBuild && isTargetBuild(storedBuild, content)))
    return errors;
  errors.push(...findStatErrors(build, storedBuild));
  errors.push(...findTargetStructureErrors(build, content));
  if (storedBuild) errors.push(...findFrozenTotalErrors(build, storedBuild));
  return errors;
}
