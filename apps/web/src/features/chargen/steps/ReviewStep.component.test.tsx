import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_CHARGEN_RULE_SET } from "@glantri/domain";
import { ReviewStep } from "./ReviewStep";

/**
 * Forgejo #372 section 0.6 — the final review and summary screens are in scope for the stale
 * legacy terminology audit, not just the browse and allocation steps.
 *
 * The summary also reuses the pool vocabulary #385 shipped ("Allocated to training / Still
 * available") rather than inventing a second way to say the same thing, and `Ordinary spent` is
 * gone because it previously labelled two different quantities.
 */
function renderReview() {
  const props = {
    chargenRuleSet: DEFAULT_CHARGEN_RULE_SET,
    draftView: {
      education: { baseEducation: 3, socialClassEducationValue: 2, theoreticalSkillCount: 5 },
      groups: [{ groupId: "G03" }],
      primaryPoolAvailable: 4,
      secondaryPoolAvailable: 6,
      skills: [{ skillId: "skill:hunting" }],
      specializations: [],
      totalSkillPointsInvested: 18,
    },
    educationLinkedSkillCount: 2,
    languageSelectionSummary: { selectedOptionalLanguageIds: [] },
    motherTongueSummary: { displayLabel: "Gothic", startingLevel: 8 },
    progression: { primaryPoolSpent: 16, secondaryPoolSpent: 4 },
    selectableSkillSummary: {
      coreSkillIds: ["skill:hunting"],
      selectableSkillIds: ["skill:tracking"],
      selectedSkillIds: [],
      selectionSlots: [],
    },
    selectedCivilization: { name: "Goths" },
    selectedProfession: { name: "Hunter and Trapper" },
    selectedProfile: { label: "Profile A" },
    selectedSocialBand: 2,
    selectedSociety: { name: "Tribal" },
    selectedSocietyAccess: { socialClass: "Free" },
  } as unknown as Parameters<typeof ReviewStep>[0];
  return render(<ReviewStep {...props} />);
}

afterEach(cleanup);

describe("Review summary", () => {
  it("carries no forbidden or stale label", () => {
    const text = renderReview().container.textContent ?? "";

    for (const label of [
      "Core reach",
      "Favored reach",
      "Included training packages",
      "Special access",
      "Choice slots",
      "Ordinary spent",
      "Skill groups",
      "Selectable pool",
    ])
      expect(text, label).not.toContain(label);
  });

  it("uses the shipped allocation vocabulary for both point pools", () => {
    const text = renderReview().container.textContent ?? "";

    expect(text).toContain("Ordinary points: allocated to training 16 / still available 4");
    expect(text).toContain("Flexible points: allocated to training 4 / still available 6");
    expect(text).toContain("Learning Groups trained: 1");
    expect(text).toContain("Points allocated to training in total: 18");
  });

  it("explains Glantri rather than the interface", () => {
    const text = renderReview().container.textContent ?? "";

    /* Section 2 of the experience contract: no instructions about where to click. */
    expect(text).not.toMatch(/Admin/);
    expect(text).toContain("Education-linked skills are learned skills that add to Education.");
  });
});
