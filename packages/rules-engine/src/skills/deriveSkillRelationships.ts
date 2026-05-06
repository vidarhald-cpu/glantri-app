import type {
  CharacterProgression,
  CharacterSkill,
  CharacterSpecialization,
  MeleeCrossTraining,
  SkillDefinition,
  SkillGroupDefinition,
  SkillSpecialization
} from "@glantri/domain";

import { calculateGroupLevel } from "./calculateGroupLevel";
import { getActiveSkillGroupIds } from "./getActiveSkillGroupIds";
import { selectBestSkillGroupContribution } from "./selectBestSkillGroupContribution";

type SpecializationBridge = NonNullable<SkillDefinition["specializationBridge"]>;

export type SkillRelationshipSourceType =
  | "explicit"
  | "melee-cross-training"
  | "specialization-bridge-child"
  | "specialization-bridge-parent";

export interface DerivedSkillGrantResult {
  factor: number;
  sourceSkillId: string;
  sourceSkillName: string;
  sourceType: SkillRelationshipSourceType;
  xp: number;
}

export interface DerivedSpecializationGrantResult {
  factor: number;
  sourceSkillId: string;
  sourceSkillName: string;
  sourceType: "specialization-bridge-parent";
  xp: number;
}

export interface ResolvedSkillRelationshipGrant {
  currentRelationshipGrantedRanks: number;
  minimumXp: number;
  previewAdditionalRanks: number;
  relationshipGrantedRanks: number;
  sourceSkillId?: string;
  sourceSkillName?: string;
  sourceType?: SkillRelationshipSourceType;
}

export interface ResolvedSpecializationRelationshipGrant {
  currentRelationshipGrantedRanks: number;
  minimumXp: number;
  previewAdditionalRanks: number;
  relationshipGrantedRanks: number;
  sourceSkillId?: string;
  sourceSkillName?: string;
  sourceType?: "specialization-bridge-parent";
}

interface RelationshipContentShape {
  skillGroups?: SkillGroupDefinition[];
  skills: SkillDefinition[];
  specializations?: SkillSpecialization[];
}

export function getMeleeCrossTrainingFactor(input: {
  source: MeleeCrossTraining | undefined;
  target: MeleeCrossTraining | undefined;
}): number {
  if (!input.source || !input.target) {
    return 0;
  }

  const distance =
    Number(input.source.attackStyle !== input.target.attackStyle) +
    Number(input.source.handClass !== input.target.handClass);

  if (distance === 1) {
    return 0.75;
  }

  if (distance === 2) {
    return 0.5;
  }

  return 0;
}

function getSpecializationBridgeParentFactor(input: {
  bridge: SpecializationBridge;
  sourceBaseXp: number;
}): number {
  if (input.sourceBaseXp < input.bridge.threshold) {
    return 0;
  }

  return Math.floor(Math.max(0, input.sourceBaseXp - input.bridge.parentExcessOffset));
}

function getSpecializationBridgeReverseXp(input: {
  bridge: SpecializationBridge;
  sourceBaseXp: number;
}): number {
  return Math.floor(input.sourceBaseXp * input.bridge.reverseFactor);
}

function getSourceTypePriority(sourceType: SkillRelationshipSourceType): number {
  switch (sourceType) {
    case "explicit":
      return 4;
    case "specialization-bridge-child":
      return 3;
    case "specialization-bridge-parent":
      return 2;
    case "melee-cross-training":
      return 1;
  }
}

function shouldReplaceDerivedGrant(
  current: DerivedSkillGrantResult | undefined,
  candidate: DerivedSkillGrantResult
): boolean {
  if (!current) {
    return true;
  }

  if (candidate.xp !== current.xp) {
    return candidate.xp > current.xp;
  }

  if (candidate.factor !== current.factor) {
    return candidate.factor > current.factor;
  }

  if (candidate.sourceType !== current.sourceType) {
    return getSourceTypePriority(candidate.sourceType) > getSourceTypePriority(current.sourceType);
  }

  if (candidate.sourceSkillName !== current.sourceSkillName) {
    return candidate.sourceSkillName.localeCompare(current.sourceSkillName) < 0;
  }

  return candidate.sourceSkillId.localeCompare(current.sourceSkillId) < 0;
}

function shouldReplaceSpecializationGrant(
  current: DerivedSpecializationGrantResult | undefined,
  candidate: DerivedSpecializationGrantResult
): boolean {
  if (!current) {
    return true;
  }

  if (candidate.xp !== current.xp) {
    return candidate.xp > current.xp;
  }

  if (candidate.factor !== current.factor) {
    return candidate.factor > current.factor;
  }

  if (candidate.sourceSkillName !== current.sourceSkillName) {
    return candidate.sourceSkillName.localeCompare(current.sourceSkillName) < 0;
  }

  return candidate.sourceSkillId.localeCompare(current.sourceSkillId) < 0;
}

function getOwnedSkillRows(
  progression: CharacterProgression,
  skillId: string
): CharacterSkill[] {
  return progression.skills.filter((skill) => skill.skillId === skillId && !skill.languageName);
}

function getBestActiveGroupContribution(input: {
  content: Pick<RelationshipContentShape, "skillGroups">;
  progression: CharacterProgression;
  skill: SkillDefinition;
}): number {
  const activeGroupIds = new Set(
    getActiveSkillGroupIds({
      progression: input.progression,
      skill: input.skill,
      skillGroups: input.content.skillGroups
    })
  );
  const contributions = input.progression.skillGroups
    .filter((group) => group.ranks > 0 && activeGroupIds.has(group.groupId))
    .map((group) => {
      const definition = input.content.skillGroups?.find(
        (candidate) => candidate.id === group.groupId
      );

      return {
        groupId: group.groupId,
        groupLevel: calculateGroupLevel({
          gms: group.gms ?? 0,
          ranks: group.ranks
        }),
        name: definition?.name ?? group.groupId,
        sortOrder: definition?.sortOrder ?? Number.MAX_SAFE_INTEGER
      };
    });

  return selectBestSkillGroupContribution(contributions)?.groupLevel ?? 0;
}

export function getSkillNonRelationshipBaseLevel(input: {
  content: Pick<RelationshipContentShape, "skillGroups">;
  progression: CharacterProgression;
  skill: SkillDefinition;
}): number {
  const groupContribution = getBestActiveGroupContribution(input);
  const bestOwnedRowTotal = getOwnedSkillRows(input.progression, input.skill.id).reduce(
    (highest, row) =>
      Math.max(
        highest,
        (row.grantedRanks ?? 0) + (row.primaryRanks ?? 0) + (row.secondaryRanks ?? 0)
      ),
    0
  );

  return groupContribution + bestOwnedRowTotal;
}

function getExistingSkillRelationshipGrantedRanks(
  progression: CharacterProgression,
  skillId: string
): number {
  return getOwnedSkillRows(progression, skillId).reduce(
    (highest, row) => Math.max(highest, row.relationshipGrantedRanks ?? 0),
    0
  );
}

function getCurrentSkillOwnedTotal(
  progression: CharacterProgression,
  skillId: string
): number {
  return getOwnedSkillRows(progression, skillId).reduce(
    (highest, row) =>
      Math.max(
        highest,
        (row.grantedRanks ?? 0) + (row.primaryRanks ?? 0) + (row.secondaryRanks ?? 0)
      ),
    0
  );
}

function getSpecializationNonRelationshipBaseLevel(
  progression: CharacterProgression,
  specializationId: string
): number {
  const specialization = progression.specializations.find(
    (item) => item.specializationId === specializationId
  );

  return specialization?.secondaryRanks ?? 0;
}

function getExistingSpecializationRelationshipGrantedRanks(
  progression: CharacterProgression,
  specializationId: string
): number {
  return (
    progression.specializations.find((item) => item.specializationId === specializationId)
      ?.relationshipGrantedRanks ?? 0
  );
}

function getCurrentSpecializationOwnedTotal(
  progression: CharacterProgression,
  specializationId: string
): number {
  return (
    progression.specializations.find((item) => item.specializationId === specializationId)
      ?.secondaryRanks ?? 0
  );
}

function createEmptySkillRow(skill: SkillDefinition): CharacterSkill {
  return {
    category: skill.category,
    categoryId: skill.categoryId,
    grantedRanks: 0,
    groupId: skill.groupIds[0] ?? skill.groupId,
    level: 0,
    primaryRanks: 0,
    ranks: 0,
    relationshipGrantedRanks: 0,
    secondaryRanks: 0,
    skillId: skill.id
  };
}

function createEmptySpecializationRow(
  specialization: SkillSpecialization
): CharacterSpecialization {
  return {
    level: 0,
    ranks: 0,
    relationshipGrantedRanks: 0,
    secondaryRanks: 0,
    skillId: specialization.skillId,
    specializationId: specialization.id
  };
}

function ensureSkillRow(
  progression: CharacterProgression,
  skill: SkillDefinition
): CharacterSkill {
  const existing = progression.skills.find(
    (row) => row.skillId === skill.id && !row.languageName
  );

  if (existing) {
    return existing;
  }

  const created = createEmptySkillRow(skill);
  progression.skills.push(created);
  return created;
}

function ensureSpecializationRow(
  progression: CharacterProgression,
  specialization: SkillSpecialization
): CharacterSpecialization {
  const existing = progression.specializations.find(
    (row) => row.specializationId === specialization.id
  );

  if (existing) {
    return existing;
  }

  const created = createEmptySpecializationRow(specialization);
  progression.specializations.push(created);
  return created;
}

function normalizeSkillRow(skill: CharacterSkill): CharacterSkill {
  const grantedRanks = skill.grantedRanks ?? 0;
  const primaryRanks = skill.primaryRanks ?? 0;
  const relationshipGrantedRanks = skill.relationshipGrantedRanks ?? 0;
  const secondaryRanks = skill.secondaryRanks ?? 0;

  skill.grantedRanks = grantedRanks;
  skill.primaryRanks = primaryRanks;
  skill.relationshipGrantedRanks = relationshipGrantedRanks;
  skill.secondaryRanks = secondaryRanks;
  skill.ranks = grantedRanks + primaryRanks + relationshipGrantedRanks + secondaryRanks;
  return skill;
}

function normalizeSpecializationRow(
  specialization: CharacterSpecialization
): CharacterSpecialization {
  const relationshipGrantedRanks = specialization.relationshipGrantedRanks ?? 0;
  const secondaryRanks = specialization.secondaryRanks ?? 0;

  specialization.relationshipGrantedRanks = relationshipGrantedRanks;
  specialization.secondaryRanks = secondaryRanks;
  specialization.ranks = relationshipGrantedRanks + secondaryRanks;
  return specialization;
}

export function deriveBestSkillRelationships(input: {
  skillBaseXpBySkillId: Map<string, number>;
  skills: SkillDefinition[];
  specializationBaseXpBySpecializationId?: Map<string, number>;
  specializations?: SkillSpecialization[];
}): {
  bestDerivedBySkillId: Map<string, DerivedSkillGrantResult>;
  bestDerivedBySpecializationId: Map<string, DerivedSpecializationGrantResult>;
} {
  const bestDerivedBySkillId = new Map<string, DerivedSkillGrantResult>();
  const bestDerivedBySpecializationId = new Map<string, DerivedSpecializationGrantResult>();
  const specializations = input.specializations ?? [];

  for (const sourceSkill of input.skills) {
    const sourceBaseXp = input.skillBaseXpBySkillId.get(sourceSkill.id) ?? 0;

    if (sourceBaseXp <= 0) {
      continue;
    }

    for (const grant of sourceSkill.derivedGrants ?? []) {
      const grantedXp = Math.floor(sourceBaseXp * grant.factor);

      if (grantedXp <= 0) {
        continue;
      }

      const candidate: DerivedSkillGrantResult = {
        factor: grant.factor,
        sourceSkillId: sourceSkill.id,
        sourceSkillName: sourceSkill.name,
        sourceType: "explicit",
        xp: grantedXp
      };
      const current = bestDerivedBySkillId.get(grant.skillId);

      if (shouldReplaceDerivedGrant(current, candidate)) {
        bestDerivedBySkillId.set(grant.skillId, candidate);
      }
    }

    for (const targetSkill of input.skills) {
      if (targetSkill.id === sourceSkill.id) {
        continue;
      }

      const factor = getMeleeCrossTrainingFactor({
        source: sourceSkill.meleeCrossTraining,
        target: targetSkill.meleeCrossTraining
      });

      if (factor <= 0) {
        continue;
      }

      const grantedXp = Math.floor(sourceBaseXp * factor);

      if (grantedXp <= 0) {
        continue;
      }

      const candidate: DerivedSkillGrantResult = {
        factor,
        sourceSkillId: sourceSkill.id,
        sourceSkillName: sourceSkill.name,
        sourceType: "melee-cross-training",
        xp: grantedXp
      };
      const current = bestDerivedBySkillId.get(targetSkill.id);

      if (shouldReplaceDerivedGrant(current, candidate)) {
        bestDerivedBySkillId.set(targetSkill.id, candidate);
      }
    }

    for (const childSkill of input.skills.filter(
      (skill) =>
        !skill.specializationOfSkillId &&
        skill.specializationBridge?.parentSkillId === sourceSkill.id
    )) {
      const grantedXp = getSpecializationBridgeParentFactor({
        bridge: childSkill.specializationBridge!,
        sourceBaseXp
      });

      if (grantedXp <= 0) {
        continue;
      }

      const candidate: DerivedSkillGrantResult = {
        factor: 1,
        sourceSkillId: sourceSkill.id,
        sourceSkillName: sourceSkill.name,
        sourceType: "specialization-bridge-parent",
        xp: grantedXp
      };
      const current = bestDerivedBySkillId.get(childSkill.id);

      if (shouldReplaceDerivedGrant(current, candidate)) {
        bestDerivedBySkillId.set(childSkill.id, candidate);
      }
    }

    for (const childSpecialization of specializations.filter(
      (specialization) => specialization.specializationBridge?.parentSkillId === sourceSkill.id
    )) {
      const grantedXp = getSpecializationBridgeParentFactor({
        bridge: childSpecialization.specializationBridge!,
        sourceBaseXp
      });

      if (grantedXp <= 0) {
        continue;
      }

      const candidate: DerivedSpecializationGrantResult = {
        factor: 1,
        sourceSkillId: sourceSkill.id,
        sourceSkillName: sourceSkill.name,
        sourceType: "specialization-bridge-parent",
        xp: grantedXp
      };
      const current = bestDerivedBySpecializationId.get(childSpecialization.id);

      if (shouldReplaceSpecializationGrant(current, candidate)) {
        bestDerivedBySpecializationId.set(childSpecialization.id, candidate);
      }
    }
  }

  for (const sourceSkill of input.skills) {
    const bridge = sourceSkill.specializationBridge;
    const sourceBaseXp = input.skillBaseXpBySkillId.get(sourceSkill.id) ?? 0;

    if (!bridge || sourceSkill.specializationOfSkillId || sourceBaseXp <= 0) {
      continue;
    }

    const grantedXp = getSpecializationBridgeReverseXp({
      bridge,
      sourceBaseXp
    });

    if (grantedXp <= 0) {
      continue;
    }

    const candidate: DerivedSkillGrantResult = {
      factor: bridge.reverseFactor,
      sourceSkillId: sourceSkill.id,
      sourceSkillName: sourceSkill.name,
      sourceType: "specialization-bridge-child",
      xp: grantedXp
    };
    const current = bestDerivedBySkillId.get(bridge.parentSkillId);

    if (shouldReplaceDerivedGrant(current, candidate)) {
      bestDerivedBySkillId.set(bridge.parentSkillId, candidate);
    }
  }

  for (const sourceSpecialization of specializations) {
    const bridge = sourceSpecialization.specializationBridge;
    const sourceBaseXp =
      input.specializationBaseXpBySpecializationId?.get(sourceSpecialization.id) ?? 0;

    if (!bridge || sourceBaseXp <= 0) {
      continue;
    }

    const grantedXp = getSpecializationBridgeReverseXp({
      bridge,
      sourceBaseXp
    });

    if (grantedXp <= 0) {
      continue;
    }

    const candidate: DerivedSkillGrantResult = {
      factor: bridge.reverseFactor,
      sourceSkillId: sourceSpecialization.id,
      sourceSkillName: sourceSpecialization.name,
      sourceType: "specialization-bridge-child",
      xp: grantedXp
    };
    const current = bestDerivedBySkillId.get(bridge.parentSkillId);

    if (shouldReplaceDerivedGrant(current, candidate)) {
      bestDerivedBySkillId.set(bridge.parentSkillId, candidate);
    }
  }

  return {
    bestDerivedBySkillId,
    bestDerivedBySpecializationId
  };
}

export function resolveRelationshipMinimumGrants(input: {
  content: RelationshipContentShape;
  progression: CharacterProgression;
}): {
  bySkillId: Map<string, ResolvedSkillRelationshipGrant>;
  bySpecializationId: Map<string, ResolvedSpecializationRelationshipGrant>;
  skillBaseXpBySkillId: Map<string, number>;
  specializationBaseXpBySpecializationId: Map<string, number>;
} {
  const skillBaseXpBySkillId = new Map(
    input.content.skills.map((skill) => [
      skill.id,
      getSkillNonRelationshipBaseLevel({
        content: input.content,
        progression: input.progression,
        skill
      })
    ])
  );
  const specializationBaseXpBySpecializationId = new Map(
    (input.content.specializations ?? []).map((specialization) => [
      specialization.id,
      getSpecializationNonRelationshipBaseLevel(input.progression, specialization.id)
    ])
  );
  const minimums = deriveBestSkillRelationships({
    skillBaseXpBySkillId,
    skills: input.content.skills,
    specializationBaseXpBySpecializationId,
    specializations: input.content.specializations
  });
  const bySkillId = new Map<string, ResolvedSkillRelationshipGrant>();
  const bySpecializationId = new Map<string, ResolvedSpecializationRelationshipGrant>();

  for (const skill of input.content.skills) {
    const bestMinimum = minimums.bestDerivedBySkillId.get(skill.id);
    const currentNonRelationshipTotal =
      skillBaseXpBySkillId.get(skill.id) ?? getCurrentSkillOwnedTotal(input.progression, skill.id);
    const currentRelationshipGrantedRanks = getExistingSkillRelationshipGrantedRanks(
      input.progression,
      skill.id
    );
    const currentRealTotal = currentNonRelationshipTotal + currentRelationshipGrantedRanks;
    const minimumXp = bestMinimum?.xp ?? 0;
    const neededAdditionalRanks = Math.max(0, minimumXp - currentRealTotal);
    const relationshipGrantedRanks = currentRelationshipGrantedRanks + neededAdditionalRanks;
    const previewAdditionalRanks = Math.max(
      0,
      relationshipGrantedRanks - currentRelationshipGrantedRanks
    );

    if (relationshipGrantedRanks <= 0 && !bestMinimum) {
      continue;
    }

    bySkillId.set(skill.id, {
      currentRelationshipGrantedRanks,
      minimumXp,
      previewAdditionalRanks,
      relationshipGrantedRanks,
      sourceSkillId: bestMinimum?.sourceSkillId,
      sourceSkillName: bestMinimum?.sourceSkillName,
      sourceType: bestMinimum?.sourceType
    });
  }

  for (const specialization of input.content.specializations ?? []) {
    const bestMinimum = minimums.bestDerivedBySpecializationId.get(specialization.id);
    const currentOwnedTotal = getCurrentSpecializationOwnedTotal(
      input.progression,
      specialization.id
    );
    const currentRelationshipGrantedRanks =
      getExistingSpecializationRelationshipGrantedRanks(
        input.progression,
        specialization.id
      );
    const currentRealTotal = currentOwnedTotal + currentRelationshipGrantedRanks;
    const minimumXp = bestMinimum?.xp ?? 0;
    const neededAdditionalRanks = Math.max(0, minimumXp - currentRealTotal);
    const relationshipGrantedRanks = currentRelationshipGrantedRanks + neededAdditionalRanks;
    const previewAdditionalRanks = Math.max(
      0,
      relationshipGrantedRanks - currentRelationshipGrantedRanks
    );

    if (relationshipGrantedRanks <= 0 && !bestMinimum) {
      continue;
    }

    bySpecializationId.set(specialization.id, {
      currentRelationshipGrantedRanks,
      minimumXp,
      previewAdditionalRanks,
      relationshipGrantedRanks,
      sourceSkillId: bestMinimum?.sourceSkillId,
      sourceSkillName: bestMinimum?.sourceSkillName,
      sourceType: bestMinimum?.sourceType
    });
  }

  return {
    bySkillId,
    bySpecializationId,
    skillBaseXpBySkillId,
    specializationBaseXpBySpecializationId
  };
}

export function applyRelationshipMinimumGrants(input: {
  content: RelationshipContentShape;
  progression: CharacterProgression;
}): CharacterProgression {
  const progression = structuredClone(input.progression);
  const resolved = resolveRelationshipMinimumGrants({
    content: input.content,
    progression
  });

  for (const skill of input.content.skills) {
    const grant = resolved.bySkillId.get(skill.id);

    if (!grant || grant.relationshipGrantedRanks <= 0) {
      continue;
    }

    const row = ensureSkillRow(progression, skill);
    row.relationshipGrantedRanks = Math.max(
      row.relationshipGrantedRanks ?? 0,
      grant.relationshipGrantedRanks
    );

    if (grant.sourceSkillId && grant.sourceSkillName && grant.sourceType) {
      row.relationshipGrantSourceSkillId = grant.sourceSkillId;
      row.relationshipGrantSourceName = grant.sourceSkillName;
      row.relationshipGrantSourceType = grant.sourceType;
    }

    normalizeSkillRow(row);
  }

  for (const specialization of input.content.specializations ?? []) {
    const grant = resolved.bySpecializationId.get(specialization.id);

    if (!grant || grant.relationshipGrantedRanks <= 0) {
      continue;
    }

    const row = ensureSpecializationRow(progression, specialization);
    row.relationshipGrantedRanks = Math.max(
      row.relationshipGrantedRanks ?? 0,
      grant.relationshipGrantedRanks
    );

    if (grant.sourceSkillId && grant.sourceSkillName && grant.sourceType) {
      row.relationshipGrantSourceSkillId = grant.sourceSkillId;
      row.relationshipGrantSourceName = grant.sourceSkillName;
      row.relationshipGrantSourceType = grant.sourceType;
    }

    normalizeSpecializationRow(row);
  }

  progression.skills = progression.skills.map(normalizeSkillRow);
  progression.specializations = progression.specializations.map(normalizeSpecializationRow);
  return progression;
}

export function deriveBestSkillRelationshipXp(input: {
  ownedXpBySkillId: Map<string, number>;
  skills: SkillDefinition[];
}): Map<string, DerivedSkillGrantResult> {
  return deriveBestSkillRelationships({
    skillBaseXpBySkillId: input.ownedXpBySkillId,
    skills: input.skills
  }).bestDerivedBySkillId;
}
