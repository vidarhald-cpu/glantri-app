import { normalizeSkillGroupId } from "@glantri/domain";

import { applySkillRelationshipMetadata, applySpecializationRelationshipMetadata } from "../skillRelationshipMetadata";
import { canonicalContentSchema, type CanonicalContent } from "../types";
import { normalizeLanguages, validateLanguages } from "./languageValidators";
import { validateProfessionRelationships } from "./professionValidators";
import {
  collectCanonicalContentWarnings,
  type CanonicalContentWarning,
  normalizeSkillGroups,
  shouldValidateSkillGroupDesign,
  validateSkillGroupDesign,
} from "./skillGroupValidators";
import { normalizeSkills, validateSkillRelationships } from "./skillValidators";
import {
  validateCivilizations,
  validateSocieties,
  validateSocietyBandRows,
  validateSocietyBandSkillAccess,
} from "./societyValidators";

export { collectCanonicalContentWarnings };
export type { CanonicalContentWarning };

export function validateCanonicalContent(input: unknown): CanonicalContent {
  const parsedContent = canonicalContentSchema.parse(input);
  const activeCanonicalGroupIds = new Set(
    parsedContent.skillGroups.map((group) => normalizeSkillGroupId(group.id) ?? group.id),
  );
  const normalizedSkills = normalizeSkills(
    applySkillRelationshipMetadata(parsedContent.skills),
    activeCanonicalGroupIds,
  );
  const normalizedContent: CanonicalContent = normalizeSkillGroups(
    normalizeLanguages({
      ...parsedContent,
      skills: normalizedSkills,
      specializations: applySpecializationRelationshipMetadata(
        parsedContent.specializations,
        normalizedSkills,
      ).filter((specialization) => specialization.skillId !== "language"),
      civilizations:
        typeof input === "object" &&
        input !== null &&
        Array.isArray((input as { civilizations?: unknown[] }).civilizations)
          ? ((input as { civilizations: CanonicalContent["civilizations"] }).civilizations ?? [])
          : parsedContent.civilizations ?? [],
    }),
  );

  const validateDesign = shouldValidateSkillGroupDesign(normalizedContent)
    ? validateSkillGroupDesign
    : (content: CanonicalContent): CanonicalContent => content;

  return validateProfessionRelationships(
    validateDesign(
      validateSkillRelationships(
        validateCivilizations(
          validateLanguages(
            validateSocieties(
              validateSocietyBandSkillAccess(validateSocietyBandRows(normalizedContent)),
            ),
          ),
        ),
      ),
    ),
  );
}
