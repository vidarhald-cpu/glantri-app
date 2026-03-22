import type {
  CharacterProgression,
  ProfessionDefinition,
  RolledCharacterProfile,
  SkillDefinition,
  SocietyLevelAccess
} from "@glantri/domain";

export interface CalculateEducationInput {
  progression?: CharacterProgression;
  profile?: RolledCharacterProfile;
  skills?: SkillDefinition[];
  society?: SocietyLevelAccess;
  societyLevel?: number;
  profession?: ProfessionDefinition | null;
}

export interface EducationBreakdown {
  baseEducation: number;
  gmInt: number;
  socialClassEducationValue: number;
  theoreticalSkillCount: number;
}

export function calculateEducation(input: CalculateEducationInput): EducationBreakdown {
  if (!input.profile) {
    return {
      baseEducation: 0,
      gmInt: 0,
      socialClassEducationValue: 0,
      theoreticalSkillCount: 0
    };
  }

  const baseEducation = input.society?.baseEducation ?? 0;
  const socialClassEducationValue = input.profile.socialClassEducationValue ?? 0;
  const theoreticalSkillCount = (input.progression?.skills ?? []).reduce((count, skill) => {
    const definition = input.skills?.find((item) => item.id === skill.skillId);
    return definition?.isTheoretical && skill.ranks > 0 ? count + 1 : count;
  }, 0);

  return {
    baseEducation,
    gmInt: 0,
    socialClassEducationValue,
    theoreticalSkillCount: baseEducation + socialClassEducationValue + theoreticalSkillCount
  };
}
