import { describe, expect, it } from "vitest";

import { defaultCanonicalContent } from "@glantri/content";
import {
  allocateChargenPoint,
  buildChargenSkillAccessSummary,
  createChargenProgression,
} from "@glantri/rules-engine";

import { formatActionError } from "./chargenWizardHelpers";
import {
  buildTargetRuntimeContent,
  createTargetCompetencyChargenSource,
} from "./targetCompetencyContent";

describe("Chargen individual-skill feedback", () => {
  it("keeps the flexible-points spend result mapped to the wizard badge", () => {
    const content = buildTargetRuntimeContent(
      createTargetCompetencyChargenSource(defaultCanonicalContent),
    );
    const flexibleRoute = content.societyLevels
      .flatMap((society) =>
        society.professionIds.map((professionId) => ({
          professionId,
          societyId: society.societyId,
          societyLevel: society.societyLevel,
        })),
      )
      .find(
        (route) =>
          !buildChargenSkillAccessSummary({ content, ...route }).normalSkillIds.includes(
            "one_handed_edged",
          ),
      );

    expect(flexibleRoute).toBeDefined();
    const input = {
      ...flexibleRoute!,
      content,
      targetId: "one_handed_edged",
      targetType: "skill" as const,
    };
    const noPool = allocateChargenPoint({
      ...input,
      progression: { ...createChargenProgression(), secondaryPoolTotal: 0 },
    });
    const firstPurchase = allocateChargenPoint({
      ...input,
      progression: { ...createChargenProgression(), secondaryPoolTotal: 1 },
    });
    expect(firstPurchase.error).toBeUndefined();
    const reallocationFailure = allocateChargenPoint({
      ...input,
      progression: { ...firstPurchase.progression, secondaryPoolSpent: 0 },
    });

    for (const result of [noPool, reallocationFailure]) {
      expect(result.error).toBeDefined();
      expect(formatActionError(result.error)).toBe("Flexible only");
      expect(result.error).toBe("No flexible points remain for this individual skill.");
    }
  });
});
