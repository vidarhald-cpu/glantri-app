import type {
  CharacterProgression,
  SkillDefinition,
  SkillSpecialization
} from "@glantri/domain";

const LITERACY_SKILL_ID = "literacy";

interface SkillSelectionContentShape {
  skills: SkillDefinition[];
}

function getSkillDependencies(skill: SkillDefinition): SkillDefinition["dependencies"] {
  const strongestDependencyBySkillId = new Map<
    string,
    SkillDefinition["dependencies"][number]
  >();
  const strengthPriority = {
    helpful: 0,
    recommended: 1,
    required: 2
  } as const;

  for (const dependency of skill.dependencies) {
    const existing = strongestDependencyBySkillId.get(dependency.skillId);

    if (
      !existing ||
      strengthPriority[dependency.strength] > strengthPriority[existing.strength]
    ) {
      strongestDependencyBySkillId.set(dependency.skillId, dependency);
    }
  }

  return [...strongestDependencyBySkillId.values()];
}

export type SkillSelectionEvaluationReasonCode =
  | "missing-required-dependency"
  | "missing-recommended-dependency"
  | "missing-helpful-dependency"
  | "missing-required-literacy"
  | "missing-recommended-literacy"
  | "invalid-specialization-parent-skill"
  | "missing-specialization-parent-skill"
  | "specialization-parent-disallows-specializations"
  | "specialization-parent-skill-too-low";

export interface SkillSelectionEvaluationMessage {
  code: SkillSelectionEvaluationReasonCode;
  currentLevel?: number;
  message: string;
  requiredLevel?: number;
  skillId?: string;
  specializationId?: string;
}

export interface SkillSelectionEvaluationResult {
  advisories: SkillSelectionEvaluationMessage[];
  blockingReasons: SkillSelectionEvaluationMessage[];
  isAllowed: boolean;
  warnings: SkillSelectionEvaluationMessage[];
}

export interface EvaluateSkillSelectionInput {
  content: SkillSelectionContentShape;
  progression: CharacterProgression;
  target:
    | {
        skill: SkillDefinition;
        targetType: "skill";
      }
    | {
        specialization: SkillSpecialization;
        targetType: "specialization";
      };
}

function getSkillDefinitionById(
  content: SkillSelectionContentShape,
  skillId: string
): SkillDefinition | undefined {
  return content.skills.find((skill) => skill.id === skillId);
}

function getPurchasedSkillLevel(
  progression: CharacterProgression,
  skillId: string
): number {
  return progression.skills.find((skill) => skill.skillId === skillId)?.ranks ?? 0;
}

function createEmptyEvaluation(): SkillSelectionEvaluationResult {
  return {
    advisories: [],
    blockingReasons: [],
    isAllowed: true,
    warnings: []
  };
}

function mergeEvaluations(
  ...evaluations: SkillSelectionEvaluationResult[]
): SkillSelectionEvaluationResult {
  const result = createEmptyEvaluation();

  for (const evaluation of evaluations) {
    result.blockingReasons.push(...evaluation.blockingReasons);
    result.warnings.push(...evaluation.warnings);
    result.advisories.push(...evaluation.advisories);
  }

  result.isAllowed = result.blockingReasons.length === 0;
  return result;
}

function createDependencyMessage(input: {
  content: SkillSelectionContentShape;
  dependency: SkillDefinition["dependencies"][number];
  targetSkill: SkillDefinition;
}): SkillSelectionEvaluationMessage {
  const dependencySkill = getSkillDefinitionById(input.content, input.dependency.skillId);
  const dependencyName = dependencySkill?.name ?? input.dependency.skillId;

  switch (input.dependency.strength) {
    case "required":
      return {
        code: "missing-required-dependency",
        message: `${input.targetSkill.name} requires ${dependencyName}.`,
        skillId: input.dependency.skillId
      };
    case "recommended":
      return {
        code: "missing-recommended-dependency",
        message: `${input.targetSkill.name} recommends ${dependencyName}.`,
        skillId: input.dependency.skillId
      };
    case "helpful":
      return {
        code: "missing-helpful-dependency",
        message: `${dependencyName} is helpful for ${input.targetSkill.name}.`,
        skillId: input.dependency.skillId
      };
  }
}

function evaluateSkillDependencies(input: {
  content: SkillSelectionContentShape;
  progression: CharacterProgression;
  skill: SkillDefinition;
}): SkillSelectionEvaluationResult {
  const result = createEmptyEvaluation();

  for (const dependency of getSkillDependencies(input.skill)) {
    if (getPurchasedSkillLevel(input.progression, dependency.skillId) > 0) {
      continue;
    }

    const message = createDependencyMessage({
      content: input.content,
      dependency,
      targetSkill: input.skill
    });

    if (dependency.strength === "required") {
      result.blockingReasons.push(message);
      continue;
    }

    if (dependency.strength === "recommended") {
      result.warnings.push(message);
      continue;
    }

    result.advisories.push(message);
  }

  result.isAllowed = result.blockingReasons.length === 0;
  return result;
}

function evaluateLiteracyRequirement(input: {
  progression: CharacterProgression;
  skill: SkillDefinition;
}): SkillSelectionEvaluationResult {
  if (
    input.skill.id === LITERACY_SKILL_ID ||
    input.skill.requiresLiteracy === "no" ||
    getPurchasedSkillLevel(input.progression, LITERACY_SKILL_ID) > 0
  ) {
    return createEmptyEvaluation();
  }

  const hasExplicitLiteracyDependency = getSkillDependencies(input.skill).some(
    (dependency) => dependency.skillId === LITERACY_SKILL_ID
  );

  if (hasExplicitLiteracyDependency) {
    return createEmptyEvaluation();
  }

  if (input.skill.requiresLiteracy === "required") {
    return {
      advisories: [],
      blockingReasons: [
        {
          code: "missing-required-literacy",
          message: `${input.skill.name} requires Literacy.`,
          skillId: LITERACY_SKILL_ID
        }
      ],
      isAllowed: false,
      warnings: []
    };
  }

  return {
    advisories: [],
    blockingReasons: [],
    isAllowed: true,
    warnings: [
      {
        code: "missing-recommended-literacy",
        message: `${input.skill.name} recommends Literacy.`,
        skillId: LITERACY_SKILL_ID
      }
    ]
  };
}

function evaluateSpecializationGate(input: {
  content: SkillSelectionContentShape;
  progression: CharacterProgression;
  specialization: SkillSpecialization;
}): SkillSelectionEvaluationResult {
  const parentSkill = getSkillDefinitionById(input.content, input.specialization.skillId);

  if (!parentSkill) {
    return {
      advisories: [],
      blockingReasons: [
        {
          code: "invalid-specialization-parent-skill",
          message: `${input.specialization.name} does not have a valid parent skill.`,
          skillId: input.specialization.skillId,
          specializationId: input.specialization.id
        }
      ],
      isAllowed: false,
      warnings: []
    };
  }

  if (!parentSkill.allowsSpecializations) {
    return {
      advisories: [],
      blockingReasons: [
        {
          code: "specialization-parent-disallows-specializations",
          message: `${parentSkill.name} does not allow specializations like ${input.specialization.name}.`,
          skillId: parentSkill.id,
          specializationId: input.specialization.id
        }
      ],
      isAllowed: false,
      warnings: []
    };
  }

  const parentLevel = getPurchasedSkillLevel(input.progression, parentSkill.id);

  if (parentLevel <= 0) {
    return {
      advisories: [],
      blockingReasons: [
        {
          code: "missing-specialization-parent-skill",
          message: `${input.specialization.name} requires ${parentSkill.name}.`,
          skillId: parentSkill.id,
          specializationId: input.specialization.id
        }
      ],
      isAllowed: false,
      warnings: []
    };
  }

  if (parentLevel < input.specialization.minimumParentLevel) {
    return {
      advisories: [],
      blockingReasons: [
        {
          code: "specialization-parent-skill-too-low",
          currentLevel: parentLevel,
          message: `${input.specialization.name} requires ${parentSkill.name} level ${input.specialization.minimumParentLevel} or higher (current ${parentLevel}).`,
          requiredLevel: input.specialization.minimumParentLevel,
          skillId: parentSkill.id,
          specializationId: input.specialization.id
        }
      ],
      isAllowed: false,
      warnings: []
    };
  }

  return {
    advisories: [],
    blockingReasons: [],
    isAllowed: true,
    warnings: []
  };
}

export function evaluateSkillSelection(
  input: EvaluateSkillSelectionInput
): SkillSelectionEvaluationResult {
  if (input.target.targetType === "skill") {
    return mergeEvaluations(
      evaluateSkillDependencies({
        content: input.content,
        progression: input.progression,
        skill: input.target.skill
      }),
      evaluateLiteracyRequirement({
        progression: input.progression,
        skill: input.target.skill
      })
    );
  }

  return evaluateSpecializationGate({
    content: input.content,
    progression: input.progression,
    specialization: input.target.specialization
  });
}
