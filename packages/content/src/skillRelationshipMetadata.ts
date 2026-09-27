import type { SkillDefinition, SkillSpecialization } from "@glantri/domain";

type SkillRelationshipMetadata = Pick<
  SkillDefinition,
  "derivedGrants" | "meleeCrossTraining" | "specializationOfSkillId"
>;

const skillRelationshipMetadataById: Record<string, SkillRelationshipMetadata> = {
  bow: {
    derivedGrants: [
      {
        factor: 0.5,
        skillId: "crossbow",
      },
    ],
  },
  crossbow: {
    derivedGrants: [
      {
        factor: 0.5,
        skillId: "bow",
      },
    ],
  },
  medicine: {
    derivedGrants: [
      {
        factor: 1,
        skillId: "first_aid",
      },
    ],
  },
  first_aid: {
    derivedGrants: [],
  },
  lance: {
    meleeCrossTraining: {
      attackStyle: "thrust",
      handClass: "two-handed",
    },
  },
  one_handed_concussion_axe: {
    meleeCrossTraining: {
      attackStyle: "strike",
      handClass: "one-handed",
    },
  },
  one_handed_edged: {
    meleeCrossTraining: {
      attackStyle: "slash",
      handClass: "one-handed",
    },
  },
  polearms: {
    meleeCrossTraining: {
      attackStyle: "thrust",
      handClass: "two-handed",
    },
  },
  two_handed_concussion_axe: {
    meleeCrossTraining: {
      attackStyle: "strike",
      handClass: "two-handed",
    },
  },
  two_handed_edged: {
    meleeCrossTraining: {
      attackStyle: "slash",
      handClass: "two-handed",
    },
  },
};

export function applySkillRelationshipMetadata(skills: SkillDefinition[]): SkillDefinition[] {
  return skills.map((skill) => {
    const metadata = skillRelationshipMetadataById[skill.id];

    if (!metadata) {
      return {
        ...skill,
        derivedGrants: skill.derivedGrants ?? [],
        meleeCrossTraining: skill.meleeCrossTraining,
        specializationOfSkillId: skill.specializationOfSkillId,
      };
    }

    return {
      ...skill,
      derivedGrants: metadata.derivedGrants ?? skill.derivedGrants ?? [],
      meleeCrossTraining: metadata.meleeCrossTraining ?? skill.meleeCrossTraining,
      specializationOfSkillId: metadata.specializationOfSkillId ?? skill.specializationOfSkillId,
    };
  });
}

/**
 * Specializations are the authored ones. The former synthetic projection existed only to give the
 * two bridged competencies, Fencing and Longbow, a Specialization row; rule decision 0010 rulings 1
 * and 2 make both base combat Skills and ruling 5 deletes the `specializationBridge` mechanism, so
 * nothing is manufactured here any more. `specializationOfSkillId` remains generic Specialization
 * plumbing; only Longbow's use of it was removed.
 */
export function applySpecializationRelationshipMetadata(
  specializations: SkillSpecialization[],
): SkillSpecialization[] {
  return specializations.map((specialization) => ({ ...specialization }));
}
