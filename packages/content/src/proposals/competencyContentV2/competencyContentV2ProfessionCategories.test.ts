import { describe, expect, it } from "vitest";

import { competencyContentV2Families } from "./competencyContentV2Source";
import {
  competencyContentV2ProfessionCategories,
  competencyContentV2ProfessionCategoryByFamilyCode,
  competencyV2ProfessionCategory,
} from "./competencyContentV2ProfessionCategories";

/**
 * The approved 16-category browsing roster (rule decision 0012).
 *
 * The roster is approved content, so these cases protect the publication against drift rather than
 * re-deciding it. The 16 -> 13 fold was rejected by the same ruling and is not reopened here.
 */
describe("Profession browsing taxonomy", () => {
  it("publishes exactly the approved sixteen categories, in their authored order", () => {
    expect(competencyContentV2ProfessionCategories).toHaveLength(16);
    expect(competencyContentV2ProfessionCategories.map((category) => category.name)).toEqual([
      "Land and Wilderness",
      "Travel, Transport and Seafaring",
      "Trade and Money",
      "Law, Office and Diplomacy",
      "Guarding and Arms Training",
      "Military Service",
      "Covert and Illicit Work",
      "Healing and Care",
      "Metal and Mechanism Crafts",
      "Building and Extraction",
      "Textile, Leather and Pottery",
      "Food and Drink",
      "Letters and Teaching",
      "Learning and Inquiry",
      "Religion and Divination",
      "Performance and Display",
    ]);
    for (const category of competencyContentV2ProfessionCategories) {
      expect(category.belongsHere.length).toBeGreaterThan(0);
      expect(category.doesNotBelongHere.length).toBeGreaterThan(0);
    }
  });

  it("maps every canonical Profession family exactly once, none missing or duplicated", () => {
    const codes = competencyContentV2Families.map((family) => family.code);
    expect(codes).toHaveLength(84);
    expect(new Set(Object.keys(competencyContentV2ProfessionCategoryByFamilyCode))).toEqual(
      new Set(codes),
    );
    for (const code of codes) expect(competencyV2ProfessionCategory(code), code).toBeDefined();
  });

  it("keeps the approved distribution, with the smallest three categories unfolded", () => {
    const sizes = new Map<string, number>();
    for (const categoryId of Object.values(competencyContentV2ProfessionCategoryByFamilyCode))
      sizes.set(categoryId, (sizes.get(categoryId) ?? 0) + 1);
    expect([...sizes.values()].sort((a, b) => b - a)).toEqual([
      8, 8, 7, 6, 6, 6, 6, 5, 5, 5, 5, 4, 4, 3, 3, 3,
    ]);
    /* The rejected fold would have moved these three into Military Service and Learning and
       Inquiry, against those categories' own stated exclusions. They stay separate. */
    expect(sizes.get("guarding-and-arms-training")).toBe(3);
    expect(sizes.get("letters-and-teaching")).toBe(3);
    expect(sizes.get("religion-and-divination")).toBe(3);
    /* Choosing one category leaves at most eight Professions to scan, against 84 today. */
    expect(Math.max(...sizes.values())).toBe(8);
  });

  it("places the ruled ambiguous cases where the approved roster places them", () => {
    const placed = (code: string) => competencyV2ProfessionCategory(code)?.name;
    expect(placed("P71")).toBe("Religion and Divination");
    expect(placed("P82")).toBe("Guarding and Arms Training");
    expect(placed("P51")).toBe("Metal and Mechanism Crafts");
    expect(placed("P50")).toBe("Learning and Inquiry");
    expect(placed("P40")).toBe("Building and Extraction");
    expect(placed("P83")).toBe("Trade and Money");
  });
});
