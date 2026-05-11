import type { CanonicalContent } from "../types";

function slugifyLanguageName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildCanonicalLanguageId(name: string): string {
  return `${slugifyLanguageName(name)}_language`;
}

function isSocietyDerivedPlaceholderLanguage(input: {
  language: CanonicalContent["languages"][number];
  societiesById: Map<string, CanonicalContent["societies"][number]>;
}): boolean {
  if (!input.language.sourceSocietyId) {
    return false;
  }

  const society = input.societiesById.get(input.language.sourceSocietyId);

  return society?.name === input.language.name;
}

export function normalizeLanguages(content: CanonicalContent): CanonicalContent {
  if (content.civilizations.length === 0) {
    return content;
  }

  const societiesById = new Map(content.societies.map((society) => [society.id, society]));
  const preservedLanguages = content.languages.filter(
    (language) => !isSocietyDerivedPlaceholderLanguage({ language, societiesById }),
  );
  const languageByName = new Map(
    preservedLanguages.map((language) => [language.name, { ...language }]),
  );
  const canonicalNameBySocietyId = new Map<string, string>();

  for (const civilization of content.civilizations) {
    const canonicalNames = [
      civilization.motherTongueLanguageName,
      civilization.spokenLanguageName,
      civilization.writtenLanguageName ?? undefined,
      ...(civilization.optionalLanguageNames ?? []),
    ].filter((name): name is string => Boolean(name?.trim()));

    for (const languageName of canonicalNames) {
      if (!languageByName.has(languageName)) {
        languageByName.set(languageName, {
          id: buildCanonicalLanguageId(languageName),
          name: languageName,
        });
      }
    }

    if (!canonicalNameBySocietyId.has(civilization.linkedSocietyId)) {
      canonicalNameBySocietyId.set(
        civilization.linkedSocietyId,
        civilization.motherTongueLanguageName || civilization.spokenLanguageName,
      );
    }
  }

  const normalizedLanguages = [...languageByName.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  const normalizedLanguageIdByName = new Map(
    normalizedLanguages.map((language) => [language.name, language.id]),
  );

  return {
    ...content,
    languages: normalizedLanguages,
    societies: content.societies.map((society) => {
      const canonicalBaselineName = canonicalNameBySocietyId.get(society.id);
      const canonicalBaselineId =
        canonicalBaselineName ? normalizedLanguageIdByName.get(canonicalBaselineName) : undefined;

      return canonicalBaselineId
        ? {
            ...society,
            baselineLanguageIds: [canonicalBaselineId],
          }
        : society;
    }),
  };
}

export function validateLanguages(content: CanonicalContent): CanonicalContent {
  const languageIds = new Set(content.languages.map((language) => language.id));
  const issues: string[] = [];

  for (const society of content.societies) {
    for (const languageId of society.baselineLanguageIds ?? []) {
      if (!languageIds.has(languageId)) {
        issues.push(
          `Society "${society.name}" (${society.id}) references unknown baseline language "${languageId}".`,
        );
      }
    }
  }

  if (issues.length > 0) {
    throw new Error(`Invalid language content:\n${issues.join("\n")}`);
  }

  return content;
}
