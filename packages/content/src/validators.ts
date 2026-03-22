import { canonicalContentSchema, type CanonicalContent } from "./types";

const EXPECTED_SOCIAL_BANDS = [1, 2, 3, 4] as const;

function validateSocietyBandRows(content: CanonicalContent): CanonicalContent {
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
        `Duplicate social band row for society "${societyLevel.societyName}" (${societyLevel.societyId}), band ${societyLevel.societyLevel}.`
      );
      continue;
    }

    seenBandKeys.add(bandKey);

    if (!EXPECTED_SOCIAL_BANDS.includes(societyLevel.societyLevel as (typeof EXPECTED_SOCIAL_BANDS)[number])) {
      issues.push(
        `Society "${societyLevel.societyName}" (${societyLevel.societyId}) uses unsupported social band ${societyLevel.societyLevel}. Expected bands: ${EXPECTED_SOCIAL_BANDS.join(", ")}.`
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
      societyName: societyLevel.societyName
    });
  }

  for (const [societyId, society] of bandsBySociety) {
    const missingBands = EXPECTED_SOCIAL_BANDS.filter((band) => !society.bands.has(band));

    if (missingBands.length > 0) {
      issues.push(
        `Society "${society.societyName}" (${societyId}) is missing social band(s): ${missingBands.join(", ")}.`
      );
    }
  }

  if (issues.length > 0) {
    throw new Error(`Invalid society social-band content:\n${issues.join("\n")}`);
  }

  return content;
}

export function validateCanonicalContent(input: unknown): CanonicalContent {
  return validateSocietyBandRows(canonicalContentSchema.parse(input));
}
