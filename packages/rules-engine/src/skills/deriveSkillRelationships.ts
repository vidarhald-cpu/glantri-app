import type {
  MeleeCrossTraining,
  SkillDefinition,
  SkillSpecialization
} from "@glantri/domain";

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
      (skill) => skill.specializationBridge?.parentSkillId === sourceSkill.id
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
    const sourceBaseXp = input.specializationBaseXpBySpecializationId?.get(sourceSpecialization.id) ?? 0;

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

export function deriveBestSkillRelationshipXp(input: {
  ownedXpBySkillId: Map<string, number>;
  skills: SkillDefinition[];
}): Map<string, DerivedSkillGrantResult> {
  return deriveBestSkillRelationships({
    skillBaseXpBySkillId: input.ownedXpBySkillId,
    skills: input.skills
  }).bestDerivedBySkillId;
}
