import { describe, expect, it } from "vitest";

import { armorTemplates } from "../../../../../packages/content/src/equipment/armorTemplates";
import { buildCharacterArmorSummary, calculateWorkbookArmorEncumbrance } from "./armorSummary";

const leatherJerkin = armorTemplates.find((template) => template.id === "armor-template-leather-jerkin") ?? null;
const fullPlate = armorTemplates.find((template) => template.id === "armor-template-full-plate-armor") ?? null;

describe("armorSummary", () => {
  it("calculates workbook-sized armor encumbrance from factor x size", () => {
    expect(
      calculateWorkbookArmorEncumbrance({
        characterSize: 13,
        item: { quantity: 1 },
        template: {
          baseEncumbrance: 0.6666666667,
          encumbranceFactor: 0.6666666667,
        },
      }),
    ).toBeCloseTo(8.6666666671, 9);
  });

  it("builds location and general armor summaries from workbook-backed armor fields", () => {
    const summary = buildCharacterArmorSummary({
      characterSize: 13,
      item: { quantity: 1 },
      template: leatherJerkin,
    });

    expect(summary).not.toBeNull();
    expect(summary?.generalArmorWithType).toBe("3B");
    expect(summary?.aaModifier).toBe(0);
    expect(summary?.perceptionModifier).toBe(0);
    expect(summary?.actualEncumbrance).toBeCloseTo(8.66666658, 6);
    expect(summary?.locations.find((location) => location.key === "chest")).toMatchObject({
      label: "Chest",
      value: 3,
      valueWithType: "3B",
    });
  });

  it("preserves heavier armor workbook values for the current character view", () => {
    const summary = buildCharacterArmorSummary({
      characterSize: 13,
      item: { quantity: 1 },
      template: fullPlate,
    });

    expect(summary).not.toBeNull();
    expect(summary?.generalArmorWithType).toBe("14E");
    expect(summary?.aaModifier).toBe(-1);
    expect(summary?.perceptionModifier).toBe(-6);
    expect(summary?.locations.find((location) => location.key === "head")?.valueWithType).toBe("20E");
    expect(summary?.actualEncumbrance).toBeCloseTo(46.2222222241, 9);
  });
});
