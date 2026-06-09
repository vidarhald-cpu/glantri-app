import { describe, expect, it } from "vitest";

import {
  COMBAT_ARMOR_MODIFIER_RULE_TABLE,
  lookupCombatArmorModifier,
  normalizeCombatArmorModifierClass,
} from "./armorModifier";

describe("combat armor modifier helpers", () => {
  it("documents the refreshed armor modifier source range", () => {
    expect(COMBAT_ARMOR_MODIFIER_RULE_TABLE).toMatchObject({
      id: "combat-armor-modifier",
      source: {
        range: "A1:G11",
        sheet: "Armor mod table",
        workbook: "docs/source/combat/New_Combat_Arena.xlsx",
      },
      title: "Combat Armor Modifier",
    });
  });

  it("looks up weapon armor class by defender armor class", () => {
    expect(lookupCombatArmorModifier({ armorClass: "E", weaponArmorClass: "A" })).toBe(-8);
    expect(lookupCombatArmorModifier({ armorClass: "D", weaponArmorClass: "B" })).toBe(-4);
    expect(lookupCombatArmorModifier({ armorClass: "C", weaponArmorClass: "A" })).toBe(-4);
    expect(lookupCombatArmorModifier({ armorClass: "B", weaponArmorClass: "A" })).toBe(-2);
    expect(lookupCombatArmorModifier({ armorClass: "A", weaponArmorClass: "E" })).toBe(0);
  });

  it("normalizes simple armor class labels and rejects compound source text", () => {
    expect(normalizeCombatArmorModifierClass(" a ")).toBe("A");
    expect(normalizeCombatArmorModifierClass("E")).toBe("E");
    expect(normalizeCombatArmorModifierClass("D/C*")).toBeUndefined();
    expect(normalizeCombatArmorModifierClass("Nix Metal")).toBeUndefined();
  });
});
