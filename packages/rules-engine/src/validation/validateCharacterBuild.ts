import type {
  CharacterBuild,
  CharacterBuildValidationResult,
  CharacterValidationIssue,
  SkillDefinition,
  SkillSpecialization
} from "@glantri/domain";

export interface ValidateCharacterBuildInput {
  build: CharacterBuild;
  availableSkills?: SkillDefinition[];
  availableSpecializations?: SkillSpecialization[];
}

export function validateCharacterBuild(
  input: ValidateCharacterBuildInput
): CharacterBuildValidationResult {
  const issues: CharacterValidationIssue[] = [];

  if (input.build.progression.level < 1) {
    issues.push({
      code: "invalid-level",
      message: "Character level must be at least 1.",
      path: "progression.level"
    });
  }

  return {
    valid: issues.length === 0,
    issues
  };
}
