import type { MeleeCrossTraining, SkillDefinition } from "@glantri/domain";

export interface DerivedSkillGrantResult {
  factor: number;
  sourceSkillId: string;
  sourceSkillName: string;
  sourceType: "explicit" | "melee-cross-training";
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
    return candidate.sourceType === "explicit";
  }

  if (candidate.sourceSkillName !== current.sourceSkillName) {
    return candidate.sourceSkillName.localeCompare(current.sourceSkillName) < 0;
  }

  return candidate.sourceSkillId.localeCompare(current.sourceSkillId) < 0;
}

export function deriveBestSkillRelationshipXp(input: {
  ownedXpBySkillId: Map<string, number>;
  skills: SkillDefinition[];
}): Map<string, DerivedSkillGrantResult> {
  const bestDerivedBySkillId = new Map<string, DerivedSkillGrantResult>();

  for (const sourceSkill of input.skills) {
    const sourceOwnedXp = input.ownedXpBySkillId.get(sourceSkill.id) ?? 0;

    if (sourceOwnedXp <= 0) {
      continue;
    }

    for (const grant of sourceSkill.derivedGrants ?? []) {
      const grantedXp = Math.floor(sourceOwnedXp * grant.factor);

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

      const grantedXp = Math.floor(sourceOwnedXp * factor);

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
  }

  return bestDerivedBySkillId;
}
