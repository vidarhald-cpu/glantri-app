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

  it("applies one point per step below zero, and flags the edge below the grid", () => {
    // #922, Product Owner ruling comment 20793. A skill total below zero used to be one of the
    // inputs the rule had no reading of, and this pipeline dropped the modifier to zero and warned
    // that no table entry existed. The rule now answers it at one point per raw step, flagged on
    // the edge below the authored grid rather than past it.
    const result = resolveRoleplaySkillRollModifiers({
      skillTotal: -1,
      modifiers: [{ bucket: "other", label: "Other", source: "manual", value: -3 }],
    });

    expect(result).toMatchObject({
      percentageModifier: -3,
      rawModifierSum: -3,
    });
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("extrapolated past the authored table");
    expect(result.warnings[0]).toContain("base_below_zero");
    expect(result.warnings[0]).not.toContain("No percentage modifier table entry");
  });

  it("has no reachable no-answer left, because it truncates both of its own inputs", () => {
    // #922. The remaining cause of a no-answer from the lookup is a non-integer figure, and this
    // pipeline passes neither: `normalizeInteger` truncates the skill total and every modifier
    // value before the lookup sees them. So the "No percentage modifier table entry" warning is
    // now unreachable from this entry point, which is asserted here rather than assumed — a
    // fractional input on either side still resolves and still applies a modifier.
    const fractionalBase = resolveRoleplaySkillRollModifiers({
      skillTotal: -1.75,
      modifiers: [{ bucket: "other", label: "Other", source: "manual", value: -3 }],
    });
    const fractionalModifier = resolveRoleplaySkillRollModifiers({
      skillTotal: 20,
      modifiers: [{ bucket: "other", label: "Other", source: "manual", value: -3.75 }],
    });

    expect(fractionalBase.percentageModifier).toBe(-3);
    expect(fractionalBase.warnings.join(" ")).not.toContain("No percentage modifier table entry");
    expect(fractionalModifier.rawModifierSum).toBe(-3);
    expect(fractionalModifier.warnings.join(" ")).not.toContain(
      "No percentage modifier table entry",
    );
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
