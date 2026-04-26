import type { SkillDefinition, SkillSpecialization } from "@glantri/domain";

type SkillRelationshipMetadata = Pick<
  SkillDefinition,
  "derivedGrants" | "meleeCrossTraining" | "specializationBridge" | "specializationOfSkillId"
>;

type SpecializationRelationshipMetadata = Pick<SkillSpecialization, "specializationBridge">;

const skillRelationshipMetadataById: Record<string, SkillRelationshipMetadata> = {
  bow: {
    derivedGrants: [
      {
        factor: 0.5,
        skillId: "crossbow"
      }
    ]
  },
  crossbow: {
    derivedGrants: [
      {
        factor: 0.5,
        skillId: "bow"
      }
    ]
  },
  medicine: {
    derivedGrants: [
      {
        factor: 1,
        skillId: "first_aid"
      }
    ]
  },
  first_aid: {
    derivedGrants: []
  },
  lance: {
    meleeCrossTraining: {
      attackStyle: "thrust",
      handClass: "two-handed"
    }
  },
  longbow: {
    specializationBridge: {
      parentExcessOffset: 5,
      parentSkillId: "bow",
      reverseFactor: 1,
      threshold: 6
    },
    specializationOfSkillId: "bow"
  },
  one_handed_concussion_axe: {
    meleeCrossTraining: {
      attackStyle: "strike",
      handClass: "one-handed"
    }
  },
  one_handed_edged: {
    meleeCrossTraining: {
      attackStyle: "slash",
      handClass: "one-handed"
    }
  },
  polearms: {
    meleeCrossTraining: {
      attackStyle: "thrust",
      handClass: "two-handed"
    }
  },
  two_handed_concussion_axe: {
    meleeCrossTraining: {
      attackStyle: "strike",
      handClass: "two-handed"
    }
  },
  two_handed_edged: {
    meleeCrossTraining: {
      attackStyle: "slash",
      handClass: "two-handed"
    }
  }
};

const specializationRelationshipMetadataById: Record<string, SpecializationRelationshipMetadata> = {
  fencing: {
    specializationBridge: {
      parentExcessOffset: 5,
      parentSkillId: "one_handed_edged",
      reverseFactor: 1,
      threshold: 6
    }
  }
};

export function applySkillRelationshipMetadata(
  skills: SkillDefinition[]
): SkillDefinition[] {
  return skills.map((skill) => {
    const metadata = skillRelationshipMetadataById[skill.id];

    if (!metadata) {
      return {
        ...skill,
        derivedGrants: skill.derivedGrants ?? [],
        meleeCrossTraining: skill.meleeCrossTraining,
        specializationBridge: skill.specializationBridge,
        specializationOfSkillId: skill.specializationOfSkillId
      };
    }

    return {
      ...skill,
      derivedGrants: metadata.derivedGrants ?? skill.derivedGrants ?? [],
      meleeCrossTraining: metadata.meleeCrossTraining ?? skill.meleeCrossTraining,
      specializationBridge: metadata.specializationBridge ?? skill.specializationBridge,
      specializationOfSkillId: metadata.specializationOfSkillId ?? skill.specializationOfSkillId
    };
  });
}

export function applySpecializationRelationshipMetadata(
  specializations: SkillSpecialization[]
): SkillSpecialization[] {
  return specializations.map((specialization) => {
    const metadata = specializationRelationshipMetadataById[specialization.id];

    if (!metadata) {
      return {
        ...specialization,
        specializationBridge: specialization.specializationBridge
      };
    }

    return {
      ...specialization,
      specializationBridge: metadata.specializationBridge ?? specialization.specializationBridge
    };
  });
}
