import { describe, expect, it } from "vitest";
import { GearTemplateSchema } from "./schemas";
import { supportsEquipmentQuantity } from "./quantity";

function template(extra: Record<string, unknown>) {
  return GearTemplateSchema.parse({
    id: "test-template",
    category: "gear",
    name: "Arrows",
    tags: [],
    defaultMaterial: "wood",
    specificityTypeDefault: "generic",
    baseEncumbrance: 0,
    ...extra,
  });
}

describe("supported creation quantities", () => {
  it("requires explicit ammunition metadata, never a name or container role", () => {
    expect(supportsEquipmentQuantity(template({}))).toBe(false);
    expect(supportsEquipmentQuantity(template({ equipmentRole: "ammunition_container" }))).toBe(
      false,
    );
    for (const family of ["arrow", "crossbow_bolt", "sling_projectile"]) {
      expect(
        supportsEquipmentQuantity(template({ ammunitionProfile: { family, quantityPerShot: 1 } })),
      ).toBe(true);
    }
  });
});
