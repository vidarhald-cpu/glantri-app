import type { CanonicalContent } from "../types";
import { EXPECTED_SOCIAL_BANDS, EXPECTED_SOCIETY_SCALE } from "./constants";

export function validateSocieties(content: CanonicalContent): CanonicalContent {
  if ((content.societies?.length ?? 0) === 0) {
    return content;
  }

  const societyIdsFromRows = new Set(content.societyLevels.map((entry) => entry.societyId));
  const societyNamesById = new Map(
    content.societyLevels.map((entry) => [entry.societyId, entry.societyName]),
  );
  const issues: string[] = [];

  for (const society of content.societies ?? []) {
    if (!EXPECTED_SOCIETY_SCALE.includes(society.societyLevel as (typeof EXPECTED_SOCIETY_SCALE)[number])) {
      issues.push(
        `Society "${society.name}" (${society.id}) uses unsupported society level ${society.societyLevel}. Expected 1-6.`,
      );
    }

    const bandName = societyNamesById.get(society.id);

    if (bandName && bandName !== society.name) {
      issues.push(
        `Society "${society.id}" uses mismatched names between societies ("${society.name}") and societyLevels ("${bandName}").`,
      );
    }
  }

  const societyDefinitionIds = new Set((content.societies ?? []).map((society) => society.id));
  const missingDefinitions = [...societyIdsFromRows].filter((societyId) => !societyDefinitionIds.has(societyId));

  if (missingDefinitions.length > 0) {
    issues.push(
      `Missing society definitions for: ${missingDefinitions
        .map((societyId) => `${societyNamesById.get(societyId) ?? societyId} (${societyId})`)
        .join(", ")}.`,
    );
  }

  if (issues.length > 0) {
    throw new Error(`Invalid society definition content:\n${issues.join("\n")}`);
  }

  return content;
}

export function validateCivilizations(content: CanonicalContent): CanonicalContent {
  if (content.civilizations.length === 0) {
    return content;
  }

  const societiesById = new Map(content.societies.map((society) => [society.id, society]));
  const issues: string[] = [];

  for (const civilization of content.civilizations) {
    const linkedSociety = societiesById.get(civilization.linkedSocietyId);

    if (!linkedSociety) {
      issues.push(
        `Civilization "${civilization.name}" (${civilization.id}) references unknown linked society "${civilization.linkedSocietyId}".`,
      );
      continue;
    }

    if (linkedSociety.societyLevel !== civilization.linkedSocietyLevel) {
      issues.push(
        `Civilization "${civilization.name}" (${civilization.id}) uses linked society level ${civilization.linkedSocietyLevel}, but linked society "${linkedSociety.name}" (${linkedSociety.id}) is level ${linkedSociety.societyLevel}.`,
      );
    }

    const seenOptionalLanguageNames = new Set<string>();

    for (const languageName of civilization.optionalLanguageNames ?? []) {
      if (languageName === civilization.motherTongueLanguageName) {
        issues.push(
          `Civilization "${civilization.name}" (${civilization.id}) repeats mother tongue "${languageName}" inside optionalLanguageNames.`,
        );
      }

      if (seenOptionalLanguageNames.has(languageName)) {
        issues.push(
          `Civilization "${civilization.name}" (${civilization.id}) repeats optional language "${languageName}".`,
        );
      }

      seenOptionalLanguageNames.add(languageName);
    }
  }

  if (issues.length > 0) {
    throw new Error(`Invalid civilization content:\n${issues.join("\n")}`);
  }

  return content;
}

export function validateSocietyBandRows(content: CanonicalContent): CanonicalContent {
  const seenBandKeys = new Set<string>();
  const bandsBySociety = new Map<
    string,
    {
      bands: Set<number>;
      societyName: string;
    }
  >();
  const issues: string[] = [];

  for (const societyLevel of content.societyLevels) {
    const bandKey = `${societyLevel.societyId}:${societyLevel.societyLevel}`;

    if (seenBandKeys.has(bandKey)) {
      issues.push(
        `Duplicate social band row for society "${societyLevel.societyName}" (${societyLevel.societyId}), band ${societyLevel.societyLevel}.`,
      );
      continue;
    }

    seenBandKeys.add(bandKey);

    if (!EXPECTED_SOCIAL_BANDS.includes(societyLevel.societyLevel as (typeof EXPECTED_SOCIAL_BANDS)[number])) {
      issues.push(
        `Society "${societyLevel.societyName}" (${societyLevel.societyId}) uses unsupported social band ${societyLevel.societyLevel}. Expected bands: ${EXPECTED_SOCIAL_BANDS.join(", ")}.`,
      );
      continue;
    }

    const existing = bandsBySociety.get(societyLevel.societyId);

    if (existing) {
      existing.bands.add(societyLevel.societyLevel);
      continue;
    }

    bandsBySociety.set(societyLevel.societyId, {
      bands: new Set([societyLevel.societyLevel]),
      societyName: societyLevel.societyName,
    });
  }

  for (const [societyId, society] of bandsBySociety) {
    const missingBands = EXPECTED_SOCIAL_BANDS.filter((band) => !society.bands.has(band));

    if (missingBands.length > 0) {
      issues.push(
        `Society "${society.societyName}" (${societyId}) is missing social band(s): ${missingBands.join(", ")}.`,
      );
    }
  }

  if (issues.length > 0) {
    throw new Error(`Invalid society social-band content:\n${issues.join("\n")}`);
  }

  return content;
}

export function validateSocietyBandSkillAccess(content: CanonicalContent): CanonicalContent {
  if (content.societyBandSkillAccess.length === 0) {
    return content;
  }

  const issues: string[] = [];
  const seenEntryKeys = new Set<string>();
  const skillIds = new Set(content.skills.map((skill) => skill.id));
  const societiesById = new Map(content.societies.map((society) => [society.id, society]));
  const societyBandRows = new Set(content.societyLevels.map((row) => `${row.societyId}:${row.societyLevel}`));

  for (const entry of content.societyBandSkillAccess) {
    const entryKey = `${entry.societyId}:${entry.socialBand}:${entry.skillId}`;

    if (seenEntryKeys.has(entryKey)) {
      issues.push(`Duplicate society-band skill access row "${entry.societyId}:L${entry.socialBand}:${entry.skillId}".`);
      continue;
    }

    seenEntryKeys.add(entryKey);

    if (!skillIds.has(entry.skillId)) {
      issues.push(
        `Society-band skill access "${entry.societyId}:L${entry.socialBand}:${entry.skillId}" references unknown skill "${entry.skillId}".`,
      );
    }

    const society = societiesById.get(entry.societyId);

    if (!society) {
      issues.push(
        `Society-band skill access "${entry.societyId}:L${entry.socialBand}:${entry.skillId}" references unknown society "${entry.societyId}".`,
      );
      continue;
    }

    if (society.name !== entry.societyName) {
      issues.push(
        `Society-band skill access "${entry.societyId}:L${entry.socialBand}:${entry.skillId}" uses mismatched society name "${entry.societyName}". Expected "${society.name}".`,
      );
    }

    if (society.societyLevel !== entry.linkedSocietyLevel) {
      issues.push(
        `Society-band skill access "${entry.societyId}:L${entry.socialBand}:${entry.skillId}" uses linked society level ${entry.linkedSocietyLevel}, but society "${society.name}" (${society.id}) is level ${society.societyLevel}.`,
      );
    }

    if (!societyBandRows.has(`${entry.societyId}:${entry.socialBand}`)) {
      issues.push(
        `Society-band skill access "${entry.societyId}:L${entry.socialBand}:${entry.skillId}" references missing social-band row "${entry.societyId}:${entry.socialBand}".`,
      );
    }
  }

  if (issues.length > 0) {
    throw new Error(`Invalid society-band skill access content:\n${issues.join("\n")}`);
  }

  return content;
}
