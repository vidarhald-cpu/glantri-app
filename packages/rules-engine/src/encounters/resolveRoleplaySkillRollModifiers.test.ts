import { describe, expect, it } from "vitest";

import { resolveRoleplaySkillRollModifiers } from "./resolveRoleplaySkillRollModifiers";

describe("resolveRoleplaySkillRollModifiers", () => {
  it("converts a raw positive modifier through the workbook percentage table", () => {
    expect(
      resolveRoleplaySkillRollModifiers({
        skillTotal: 20,
        modifiers: [{ bucket: "other", label: "Other", source: "manual", value: 3 }],
      }),
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
      }),
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
      }),
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
      }),
    ).toMatchObject({
      percentageModifier: 0,
      rawModifierSum: 0,
      warnings: [],
    });
  });

  /**
   * #922. A skill total is total skill XP, so the authored grid's last base row of 49 is reached in
   * ordinary play. This used to drop the modifier to zero and warn that the table had no entry;
   * the rule the table illustrates has one, so the modifier applies and the figure is flagged.
   */
  it("applies a modifier past the authored base rows and flags it for review", () => {
    const result = resolveRoleplaySkillRollModifiers({
      skillTotal: 60,
      modifiers: [{ bucket: "other", label: "Other", source: "manual", value: -3 }],
    });

    expect(result).toMatchObject({
      percentageModifier: -18,
      rawModifierSum: -3,
    });
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("extrapolated past the authored table");
    expect(result.warnings[0]).toContain("base");
    expect(result.warnings[0]).not.toContain("No percentage modifier table entry");
  });

  it("still reports an input the rule has no reading of, and applies nothing", () => {
    const result = resolveRoleplaySkillRollModifiers({
      skillTotal: -1,
      modifiers: [{ bucket: "other", label: "Other", source: "manual", value: -3 }],
    });

    expect(result).toMatchObject({
      percentageModifier: 0,
      rawModifierSum: -3,
    });
    expect(result.warnings[0]).toContain("No percentage modifier table entry");
  });

  it("flags nothing for a modifier inside the authored grid", () => {
    expect(
      resolveRoleplaySkillRollModifiers({
        skillTotal: 49,
        modifiers: [{ bucket: "other", label: "Other", source: "manual", value: -3 }],
      }),
    ).toMatchObject({ percentageModifier: -15, rawModifierSum: -3, warnings: [] });
  });
});
