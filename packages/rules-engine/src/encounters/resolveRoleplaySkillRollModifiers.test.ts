import { describe, expect, it } from "vitest";

import { resolveRoleplaySkillRollModifiers } from "./resolveRoleplaySkillRollModifiers";

describe("resolveRoleplaySkillRollModifiers", () => {
  it("converts a raw positive modifier through the workbook percentage table", () => {
    expect(
      resolveRoleplaySkillRollModifiers({
        skillTotal: 20,
        modifiers: [{ bucket: "other", label: "Other", source: "manual", value: 3 }],
      })
    ).toMatchObject({
      percentageModifier: 6,
      rawModifierSum: 3,
      warnings: [],
    });
  });

  it("preserves the sign after looking up the absolute raw modifier", () => {
    expect(
      resolveRoleplaySkillRollModifiers({
        skillTotal: 20,
        modifiers: [{ bucket: "other", label: "Unknown skill", source: "manual", value: -3 }],
      })
    ).toMatchObject({
      percentageModifier: -6,
      rawModifierSum: -3,
      warnings: [],
    });
  });

  it("sums structured raw modifiers before applying the percentage table", () => {
    expect(
      resolveRoleplaySkillRollModifiers({
        skillTotal: 23,
        modifiers: [
          { bucket: "general", label: "Weather", source: "situationMap", value: 2 },
          { bucket: "other", label: "GM override", source: "gmOverride", value: -5 },
        ],
      })
    ).toMatchObject({
      percentageModifier: -7,
      rawModifierSum: -3,
      warnings: [],
    });
  });

  it("returns zero without warning when the raw modifier sum is zero", () => {
    expect(
      resolveRoleplaySkillRollModifiers({
        skillTotal: 20,
        modifiers: [
          { bucket: "general", label: "Cover", source: "situationMap", value: -2 },
          { bucket: "other", label: "GM override", source: "gmOverride", value: 2 },
        ],
      })
    ).toMatchObject({
      percentageModifier: 0,
      rawModifierSum: 0,
      warnings: [],
    });
  });

  it("warns when the workbook table has no matching entry", () => {
    const result = resolveRoleplaySkillRollModifiers({
      skillTotal: 60,
      modifiers: [{ bucket: "other", label: "Other", source: "manual", value: -3 }],
    });

    expect(result).toMatchObject({
      percentageModifier: 0,
      rawModifierSum: -3,
    });
    expect(result.warnings[0]).toContain("No percentage modifier table entry");
  });
});
