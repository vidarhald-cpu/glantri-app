import { describe, expect, it } from "vitest";
import { CanonicalEquipmentItemSchema } from "./schemas";
import { createEmptyEquipmentItemFacts, revealableEquipmentState } from "./itemFacts";
import { getEffectiveEncumbrance } from "./derived";
import {
  armorComponentKey,
  getItemOverrideChoices,
  ItemMechanicalOverridesSchema,
  resolveEffectiveItemTemplate,
  type ItemMechanicalOverride,
} from "./itemOverrides";
import type { ArmorTemplate, EquipmentItem, ShieldTemplate, WeaponTemplate } from "./types";

const weapon: WeaponTemplate = {
  id: "sword",
  category: "weapon",
  name: "Sword",
  tags: [],
  specificityTypeDefault: "generic",
  defaultMaterial: "steel",
  baseEncumbrance: 4,
  weaponClass: "sword",
  weaponSkill: "Sword",
  handlingClass: "one_handed",
  parry: 2,
  initiative: 3,
  attackModes: [
    {
      id: "slash",
      label: "Slash",
      ob: 4,
      dmb: 2,
      dmbFormula: { kind: "numeric", raw: "2", numericValue: 2 },
      allowsRepeatedRoundAttack: false,
      provenance: "imported",
    },
  ],
};
const input = (value: number): ItemMechanicalOverride => ({
  kind: "input",
  property: "baseEncumbrance",
  value,
  visibility: "gm_only",
});
const item = (mechanicalOverrides: ItemMechanicalOverride[] = []) => ({
  templateId: weapon.id,
  mechanicalOverrides,
});

describe("effective Item inputs", () => {
  it("inherits live values independently, preserves zero and removes the exception on revert", () => {
    const registry = { sword: structuredClone(weapon) };
    const inherited = item();
    const overridden = item([input(0)]);
    expect(resolveEffectiveItemTemplate(overridden, registry)?.baseEncumbrance).toBe(0);
    registry.sword.baseEncumbrance = 3;
    expect(resolveEffectiveItemTemplate(inherited, registry)?.baseEncumbrance).toBe(3);
    expect(resolveEffectiveItemTemplate(overridden, registry)?.baseEncumbrance).toBe(0);
    overridden.mechanicalOverrides = [];
    expect(resolveEffectiveItemTemplate(overridden, registry)?.baseEncumbrance).toBe(3);
    expect(registry.sword.attackModes?.[0].allowsRepeatedRoundAttack).toBe(false);
  });
  it("recomputes numeric DMB and source aliases without touching the Template", () => {
    const original = JSON.stringify(weapon);
    const result = resolveEffectiveItemTemplate(
      item([
        {
          kind: "attack",
          modeId: "slash",
          property: "numericValue",
          value: 0,
          visibility: "revealed",
        },
        { kind: "attack", modeId: "slash", property: "ob", value: 5, visibility: "revealed" },
      ]),
      { sword: weapon },
    ) as WeaponTemplate;
    expect(result.attackModes?.[0]).toMatchObject({
      ob: 5,
      obRaw: "5",
      dmb: 0,
      dmbFormula: { numericValue: 0 },
    });
    expect(result).toMatchObject({ ob1: 5, dmb1: 0 });
    expect(JSON.stringify(weapon)).toBe(original);
  });
  it("rejects structural, derived, unknown, duplicate and wrong-category input paths", () => {
    for (const property of [
      "handlingClass",
      "finalAttackOb",
      "shieldBonus",
      "armorRating",
      "arbitrary",
      "isStackable",
    ]) {
      expect(
        ItemMechanicalOverridesSchema.safeParse([{ kind: "input", property, value: 1 }]).success,
      ).toBe(false);
    }
    expect(() =>
      resolveEffectiveItemTemplate(item([input(1), input(2)]), { sword: weapon }),
    ).toThrow();
    expect(() =>
      resolveEffectiveItemTemplate(
        item([{ kind: "input", property: "movementModifier", value: 1, visibility: "gm_only" }]),
        { sword: weapon },
      ),
    ).toThrow();
    expect(() =>
      resolveEffectiveItemTemplate(
        item([
          { kind: "attack", modeId: "slash", property: "dmb", value: 9, visibility: "gm_only" },
        ]),
        { sword: weapon },
      ),
    ).toThrow();
    expect(() =>
      resolveEffectiveItemTemplate(
        item([
          { kind: "attack", modeId: "missing", property: "ob", value: 1, visibility: "gm_only" },
        ]),
        { sword: weapon },
      ),
    ).toThrow();
  });
  it("preserves false as inherited structural state without exposing a Boolean capability override", () => {
    const result = resolveEffectiveItemTemplate(item([input(5)]), {
      sword: weapon,
    }) as WeaponTemplate;
    expect(result.attackModes?.[0].allowsRepeatedRoundAttack).toBe(false);
    expect(
      ItemMechanicalOverridesSchema.safeParse([
        { kind: "input", property: "baseEncumbrance", value: false },
      ]).success,
    ).toBe(false);
  });
  it("keeps shield aliases consistent", () => {
    const shield: ShieldTemplate = {
      ...weapon,
      id: "shield",
      category: "shield",
      defensiveValue: 4,
      shieldBonus: 4,
    };
    const result = resolveEffectiveItemTemplate(
      {
        templateId: shield.id,
        mechanicalOverrides: [
          { kind: "input", property: "defensiveValue", value: 0, visibility: "revealed" },
        ],
      },
      { shield },
    ) as ShieldTemplate;
    expect(result.defensiveValue).toBe(0);
    expect(result.shieldBonus).toBe(0);
  });
  it("binds armor inputs by component identity and derives sums, rounding and critical lookup", () => {
    const armor: ArmorTemplate = {
      ...weapon,
      id: "armor",
      category: "armor",
      sourceMetadata: undefined,
      componentProfiles: [
        { name: "Vest", encumbranceFactor: 1, locationValues: { chest: 3 } },
        { name: "Sleeves", encumbranceFactor: 2, locationValues: { frontArm: 2 } },
      ],
      movementFactor: 1,
    };
    const override: ItemMechanicalOverride = {
      kind: "armor",
      componentKey: armorComponentKey(armor.componentProfiles![0]),
      property: "chest",
      value: 9,
      visibility: "revealed",
    };
    const result = resolveEffectiveItemTemplate(
      { templateId: armor.id, mechanicalOverrides: [override] },
      { armor },
    ) as ArmorTemplate;
    expect(result.encumbranceFactor).toBe(3);
    expect(result.baseEncumbrance).toBe(3);
    expect(result.armorRating).toBe(11 / 9);
    expect(result.generalArmorRounded).toBe(1);
    expect(result.criticalModifierByArea?.chest).toBe(4);
    expect(result.criticalModifierGeneral).toBe(0);
    armor.componentProfiles!.reverse();
    expect(
      (
        resolveEffectiveItemTemplate(
          { templateId: armor.id, mechanicalOverrides: [override] },
          { armor },
        ) as ArmorTemplate
      ).locationValues?.chest,
    ).toBe(9);
    expect(
      getItemOverrideChoices(armor).some(
        (choice) => choice.entry.kind === "input" && choice.entry.property === "baseEncumbrance",
      ),
    ).toBe(false);
  });
  it("uses the physical ENC source with established quantity/material/quality/carry factors and preserves legacy override semantics", () => {
    const carried: EquipmentItem = {
      id: "i",
      characterId: "c",
      templateId: "sword",
      category: "weapon",
      specificityType: "generic",
      quantity: 20,
      isStackable: true,
      material: "bronze",
      quality: "extraordinary",
      conditionState: "intact",
      storageAssignment: { locationId: "pack", carryMode: "backpack" },
      mechanicalOverrides: [input(2)],
    };
    expect(getEffectiveEncumbrance(carried, weapon)).toBeCloseTo(2 * 20 * 1.1 * 0.9 * 0.75);
    expect(getEffectiveEncumbrance({ ...carried, encumbranceOverride: 7 }, weapon)).toBe(7);
  });
  it("keeps descriptive Items nonmechanical and validates names/binding while preserving ordinary false", () => {
    const descriptive = {
      id: "letter",
      templateId: null,
      category: null,
      itemKind: "descriptive_only",
      displayName: "Letter from Jaggar",
      characterId: null,
      holderCharacterId: null,
      storageAssignment: null,
      specificityType: "specific",
      quantity: 1,
      isStackable: false,
      material: "other",
      quality: "standard",
      conditionState: "intact",
      isFavorite: false,
      itemFacts: createEmptyEquipmentItemFacts(),
      physicalBaseEncumbrance: 0,
    };
    expect(CanonicalEquipmentItemSchema.parse(descriptive).isFavorite).toBe(false);
    expect(resolveEffectiveItemTemplate({ templateId: null }, { sword: weapon })).toBeUndefined();
    expect(
      CanonicalEquipmentItemSchema.safeParse({ ...descriptive, category: "weapon" }).success,
    ).toBe(false);
    expect(
      CanonicalEquipmentItemSchema.safeParse({ ...descriptive, mechanicalOverrides: [input(1)] })
        .success,
    ).toBe(false);
    expect(
      CanonicalEquipmentItemSchema.safeParse({ ...descriptive, displayName: "" }).success,
    ).toBe(false);
  });
  it("removes hidden overrides from captured player payloads", () => {
    const state = {
      itemsById: { i: { ...item([input(991)]), itemFacts: createEmptyEquipmentItemFacts() } },
    };
    expect(JSON.stringify(revealableEquipmentState(state))).not.toContain("991");
    expect(state.itemsById.i.mechanicalOverrides).toHaveLength(1);
  });
});
