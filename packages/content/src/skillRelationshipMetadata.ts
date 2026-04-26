import type { SkillDefinition } from "@glantri/domain";

type SkillRelationshipMetadata = Pick<SkillDefinition, "derivedGrants" | "meleeCrossTraining">;

const skillRelationshipMetadataById: Record<string, SkillRelationshipMetadata> = {
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

export function applySkillRelationshipMetadata(
  skills: SkillDefinition[]
): SkillDefinition[] {
  return skills.map((skill) => {
    const metadata = skillRelationshipMetadataById[skill.id];

    if (!metadata) {
      return {
        ...skill,
        derivedGrants: skill.derivedGrants ?? [],
        meleeCrossTraining: skill.meleeCrossTraining
      };
    }

    return {
      ...skill,
      derivedGrants: metadata.derivedGrants ?? skill.derivedGrants ?? [],
      meleeCrossTraining: metadata.meleeCrossTraining ?? skill.meleeCrossTraining
    };
  });
}
