import { describe, expect, it } from "vitest";

import {
  buildSkillSystemAiExport,
  buildSkillSystemNote
} from "./exportSkillSystemForAi";

describe("skill-system AI export", () => {
  it("builds the required top-level sections", () => {
    const exported = buildSkillSystemAiExport({
      appCommit: "test-commit",
      generatedAt: "2026-05-11T00:00:00.000Z"
    });

    expect(exported).toHaveProperty("metadata");
    expect(exported).toHaveProperty("civilizations");
    expect(exported).toHaveProperty("societies");
    expect(exported).toHaveProperty("socialClasses");
    expect(exported).toHaveProperty("skills");
    expect(exported).toHaveProperty("skillGroups");
    expect(exported).toHaveProperty("specializations");
    expect(exported).toHaveProperty("professions");
    expect(exported).toHaveProperty("professionFamilies");
    expect(exported).toHaveProperty("professionPackages");
    expect(exported).toHaveProperty("availability");
    expect(exported).toHaveProperty("relationships");
    expect(exported).toHaveProperty("derivedRules");
    expect(exported).toHaveProperty("adminMetrics");
  });

  it("exports Longbow as a Bow specialization and not as a basic missile slot candidate", () => {
    const exported = buildSkillSystemAiExport({
      appCommit: "test-commit",
      generatedAt: "2026-05-11T00:00:00.000Z"
    });
    const longbowSpecialization = exported.specializations.find((item) => item.id === "longbow");
    const basicMissile = exported.skillGroups.find((item) => item.id === "basic_missile_training");

    expect(longbowSpecialization).toMatchObject({
      id: "longbow",
      parentSkillId: "bow",
      isSelectableAsNormalSkill: false
    });
    expect(
      basicMissile?.selectionSlots.flatMap((slot) => slot.candidateSkillIds)
    ).not.toContain("longbow");
  });

  it("includes admin metrics and the AI note guardrails", () => {
    const exported = buildSkillSystemAiExport({
      appCommit: "test-commit",
      generatedAt: "2026-05-11T00:00:00.000Z"
    });

    expect(exported.adminMetrics.groupWeightedValues.length).toBeGreaterThan(0);
    expect(exported.adminMetrics.professionReach.length).toBeGreaterThan(0);
    expect(buildSkillSystemNote()).toContain("Longbow is specialization of Bow");
  });
});
