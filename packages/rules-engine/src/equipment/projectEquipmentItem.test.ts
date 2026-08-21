import { describe, expect, it } from "vitest";
import {
  CanonicalEquipmentItemSchema,
  EquipmentItemFactsV1Schema,
  type ArmorTemplate,
  type CanonicalEquipmentItem,
  type EquipmentItemFactsV1,
  type EquipmentTemplate,
  type ShieldTemplate,
  type WeaponTemplate,
} from "@glantri/domain";

import {
  getEffectiveItemCharacteristic,
  getFinalAttackObDelta,
  projectEquipmentItem,
  type EffectiveEquipmentItemProjection,
  type EffectiveItemCharacteristicKind,
  type EffectiveItemCharacteristicScope,
} from "./projectEquipmentItem";

const dagger: WeaponTemplate = {
  attackModes: [
    {
      crit: "EP",
      dmb: 4,
      id: "slash",
      initiative: 2,
      label: "Slash",
      ob: 7,
      provenance: "imported",
      range: "1.5",
    },
    {
      crit: "DP",
      dmbFormula: {
        diceCount: 2,
        diceSides: 6,
        flatModifier: 0,
        kind: "dice",
        raw: "2d6 + GMstr",
        textModifier: "GMstr",
      },
      id: "thrust",
      initiative: 3,
      label: "Thrust",
      ob: 6,
      provenance: "imported",
      range: "1",
    },
  ],
  baseEncumbrance: 2,
  baseValue: 5,
  category: "weapon",
  defaultMaterial: "steel",
  defensiveValue: 1,
  durabilityProfile: {
    breakThreshold: 2,
    edgeSensitive: true,
    maxDurabilityDefault: 10,
    shaftSensitive: false,
    wearSensitivity: "medium",
  },
  handlingClass: "light",
  id: "weapon-template-dagger",
  initiative: 2,
  name: "Dagger",
  parry: -3,
  range: "1.0",
  specificityTypeDefault: "generic",
  tags: ["knife"],
  weaponClass: "knife",
  weaponSkill: "1-h edged",
};

const shield: ShieldTemplate = {
  baseEncumbrance: 3,
  baseValue: 8,
  category: "shield",
  defaultMaterial: "wood",
  defensiveValue: 4,
  id: "shield-template-round",
  movementModifier: -1,
  name: "Round shield",
  parry: 2,
  shieldBonus: 3,
  specificityTypeDefault: "generic",
  tags: ["shield"],
};

const armor: ArmorTemplate = {
  armorActivityModifier: -1,
  armorRating: 9,
  baseEncumbrance: 4,
  baseValue: 20,
  category: "armor",
  criticalModifierByArea: {
    abdomen: 2,
    backArm: 2,
    backFoot: 2,
    backThigh: 2,
    chest: 2,
    frontArm: 2,
    frontFoot: 2,
    frontThigh: 2,
    head: 2,
  },
  criticalModifierGeneral: 2,
  defaultMaterial: "steel",
  encumbranceFactor: 4,
  generalArmorRounded: 9,
  id: "armor-template-mail",
  locationTypes: { chest: "mail" },
  locationValues: {
    abdomen: 9,
    backArm: 9,
    backFoot: 9,
    backThigh: 9,
    chest: 9,
    frontArm: 9,
    frontFoot: 9,
    frontThigh: 9,
    head: 9,
  },
  mobilityPenalty: -2,
  movementFactor: -2,
  name: "Mail coat",
  perceptionModifier: -3,
  specificityTypeDefault: "generic",
  tags: ["armor"],
};

function item(
  template: EquipmentTemplate,
  itemFacts: EquipmentItemFactsV1 = {
    activeMechanics: [],
    characteristics: [],
    descriptiveTraits: [],
    templateOverrides: [],
    unsupportedCapabilities: [],
    version: 1,
  },
  overrides: Partial<CanonicalEquipmentItem> = {},
): CanonicalEquipmentItem {
  return CanonicalEquipmentItemSchema.parse({
    campaignContextId: "campaign-glantri",
    category: template.category,
    characterId: "character-themistogenes",
    conditionState: "intact",
    durabilityCurrent: template.category === "weapon" ? 7 : null,
    durabilityMax:
      template.category === "weapon"
        ? (template.durabilityProfile?.maxDurabilityDefault ?? null)
        : null,
    encumbranceOverride: null,
    holderCharacterId: "character-themistogenes",
    id: `item-${template.id}`,
    isEquipped: true,
    isStackable: false,
    itemFacts,
    material: template.defaultMaterial,
    quality: "extraordinary",
    quantity: 1,
    specificityType: "specific",
    storageAssignment: {
      carryMode: "equipped",
      locationId: "character-themistogenes:loc-equipped",
    },
    templateId: template.id,
    valueOverride: null,
    ...overrides,
  });
}

function characteristic(
  projection: EffectiveEquipmentItemProjection,
  kind: EffectiveItemCharacteristicKind,
  scope: EffectiveItemCharacteristicScope,
) {
  const result = getEffectiveItemCharacteristic(projection, kind, scope);
  expect(result, `${kind} ${JSON.stringify(scope)}`).toBeDefined();
  return result!;
}

describe("canonical effective Item projection", () => {
  it("projects an ordinary Dagger as inherited weapon and Item basics", () => {
    const projection = projectEquipmentItem(item(dagger), dagger);

    expect(
      characteristic(projection, "attack_mode_ob", { kind: "attack_mode", attackModeId: "slash" }),
    ).toMatchObject({
      activationState: "inherited",
      authorable: true,
      contributions: [],
      effectiveValue: 7,
      templateValue: 7,
    });
    expect(
      characteristic(projection, "attack_mode_dmb", { kind: "attack_mode", attackModeId: "slash" })
        .effectiveValue,
    ).toBe(4);
    expect(
      characteristic(projection, "fallback_initiative", { kind: "equipment" }).effectiveValue,
    ).toBe(2);
    expect(characteristic(projection, "weapon_parry", { kind: "equipment" }).effectiveValue).toBe(
      -3,
    );
    expect(
      characteristic(projection, "weapon_defensive_value", { kind: "equipment" }).effectiveValue,
    ).toBe(1);
    expect(
      characteristic(projection, "maximum_durability", { kind: "equipment" }).effectiveValue,
    ).toBe(10);
    expect(
      characteristic(projection, "base_encumbrance", { kind: "equipment" }).effectiveValue,
    ).toBe(2);
    expect(characteristic(projection, "base_value", { kind: "equipment" }).effectiveValue).toBe(5);
  });

  it("applies exact scoped OB and numeric/dice-flat DMB deltas without changing other modes", () => {
    const projection = projectEquipmentItem(
      item(dagger, {
        activeMechanics: [],
        characteristics: [
          {
            id: "slash-ob",
            kind: "attack_mode_ob_delta",
            scope: { attackModeId: "slash", kind: "attack_mode" },
            unit: "ob_points",
            value: 2,
            visibility: "revealed",
          },
          {
            id: "slash-dmb",
            kind: "attack_mode_dmb_delta",
            scope: { attackModeId: "slash", kind: "attack_mode" },
            unit: "dmb_points",
            value: -1,
            visibility: "revealed",
          },
          {
            id: "thrust-dmb",
            kind: "attack_mode_dmb_delta",
            scope: { attackModeId: "thrust", kind: "attack_mode" },
            unit: "dmb_points",
            value: 2,
            visibility: "revealed",
          },
          {
            id: "thrust-initiative",
            kind: "attack_mode_initiative_delta",
            scope: { attackModeId: "thrust", kind: "attack_mode" },
            unit: "initiative_points",
            value: 2,
            visibility: "revealed",
          },
          {
            id: "fallback-initiative",
            kind: "fallback_initiative_delta",
            scope: { kind: "equipment" },
            unit: "initiative_points",
            value: -1,
            visibility: "revealed",
          },
          {
            id: "weapon-parry",
            kind: "weapon_parry_delta",
            scope: { kind: "equipment" },
            unit: "parry_points",
            value: 1,
            visibility: "revealed",
          },
          {
            id: "weapon-dv",
            kind: "weapon_defensive_value_delta",
            scope: { kind: "equipment" },
            unit: "defensive_value_points",
            value: -1,
            visibility: "revealed",
          },
        ],
        descriptiveTraits: [],
        templateOverrides: [],
        unsupportedCapabilities: [],
        version: 1,
      }),
      dagger,
    );

    expect(
      characteristic(projection, "attack_mode_ob", { kind: "attack_mode", attackModeId: "slash" })
        .effectiveValue,
    ).toBe(9);
    expect(
      characteristic(projection, "attack_mode_ob", { kind: "attack_mode", attackModeId: "thrust" })
        .effectiveValue,
    ).toBe(6);
    expect(
      characteristic(projection, "attack_mode_dmb", { kind: "attack_mode", attackModeId: "slash" })
        .effectiveValue,
    ).toBe(3);
    expect(
      characteristic(projection, "attack_mode_dmb", { kind: "attack_mode", attackModeId: "thrust" })
        .effectiveValue,
    ).toMatchObject({
      diceCount: 2,
      diceSides: 6,
      flatModifier: 2,
      raw: "2d6 + GMstr",
      textModifier: "GMstr",
    });
    expect(
      (projection.effectiveTemplate as WeaponTemplate).attackModes?.[1]?.dmbFormula,
    ).toMatchObject({
      diceCount: 2,
      diceSides: 6,
      flatModifier: 2,
      textModifier: "GMstr",
    });
    expect(
      characteristic(projection, "attack_mode_initiative", {
        kind: "attack_mode",
        attackModeId: "thrust",
      }).effectiveValue,
    ).toBe(5);
    expect(
      characteristic(projection, "fallback_initiative", { kind: "equipment" }).effectiveValue,
    ).toBe(1);
    expect(characteristic(projection, "weapon_parry", { kind: "equipment" }).effectiveValue).toBe(
      -2,
    );
    expect(
      characteristic(projection, "weapon_defensive_value", { kind: "equipment" }).effectiveValue,
    ).toBe(0);
  });

  it("converts legacy initiative absolute 1 over source 2 into delta -1 for fallback and every exact mode", () => {
    const legacyItem = item(dagger, {
      activeMechanics: [],
      characteristics: [],
      descriptiveTraits: [],
      templateOverrides: [
        {
          id: "legacy-initiative",
          kind: "weapon_initiative_override",
          provenance: {
            migration: "v1-relative-initiative",
            source: "legacy_item_fact",
            sourceTemplateId: dagger.id,
            sourceTemplateValue: 2,
            sourceTemplateVersion: "weapon-table-2026-08-20",
          },
          scope: "all_attack_modes",
          unit: "initiative_points",
          value: 1,
          visibility: "revealed",
        },
      ],
      unsupportedCapabilities: [],
      version: 1,
    });
    const projection = projectEquipmentItem(legacyItem, dagger);

    const slash = characteristic(projection, "attack_mode_initiative", {
      attackModeId: "slash",
      kind: "attack_mode",
    });
    const thrust = characteristic(projection, "attack_mode_initiative", {
      attackModeId: "thrust",
      kind: "attack_mode",
    });
    expect([slash.effectiveValue, thrust.effectiveValue]).toEqual([1, 2]);
    expect(slash.contributions[0]).toMatchObject({
      factId: "legacy-initiative",
      originalValue: 1,
      sourceKind: "legacy_weapon_initiative_override",
      value: -1,
    });
    expect(slash.contributions[0]?.provenance).toMatchObject({
      sourceTemplateValue: 2,
      sourceTemplateVersion: "weapon-table-2026-08-20",
    });
    expect(
      characteristic(projection, "fallback_initiative", { kind: "equipment" }).effectiveValue,
    ).toBe(1);

    const hiddenFacts = structuredClone(legacyItem.itemFacts);
    hiddenFacts.templateOverrides[0] = {
      ...hiddenFacts.templateOverrides[0]!,
      active: undefined,
      visibility: "gm_only",
    };
    const hidden = projectEquipmentItem(item(dagger, hiddenFacts), dagger);
    const hiddenPlayer = projectEquipmentItem(item(dagger, hiddenFacts), dagger, {
      audience: "player",
    });
    expect(
      characteristic(hidden, "attack_mode_initiative", {
        attackModeId: "slash",
        kind: "attack_mode",
      }),
    ).toMatchObject({ activationState: "hidden_dormant", effectiveValue: 2 });
    expect(JSON.stringify(hiddenPlayer)).not.toContain("legacy-initiative");
  });

  it("enforces hidden dormant, revealed inactive, and revealed active privacy states", () => {
    const hidden = item(dagger, {
      activeMechanics: [],
      characteristics: [
        {
          id: "secret-ob",
          kind: "attack_mode_ob_delta",
          scope: { attackModeId: "slash", kind: "attack_mode" },
          unit: "ob_points",
          value: 2,
          visibility: "gm_only",
        },
      ],
      descriptiveTraits: [],
      templateOverrides: [],
      unsupportedCapabilities: [],
      version: 1,
    });
    const gmHidden = characteristic(projectEquipmentItem(hidden, dagger), "attack_mode_ob", {
      attackModeId: "slash",
      kind: "attack_mode",
    });
    const playerHidden = characteristic(
      projectEquipmentItem(hidden, dagger, { audience: "player" }),
      "attack_mode_ob",
      { attackModeId: "slash", kind: "attack_mode" },
    );
    expect(gmHidden).toMatchObject({
      activationState: "hidden_dormant",
      effectiveValue: 7,
    });
    expect(playerHidden).toMatchObject({ activationState: "inherited", contributions: [] });
    expect(JSON.stringify(playerHidden)).not.toContain("secret-ob");

    const inactiveFacts = structuredClone(hidden.itemFacts);
    inactiveFacts.characteristics![0] = {
      ...inactiveFacts.characteristics![0]!,
      active: false,
      visibility: "revealed",
    };
    expect(
      characteristic(projectEquipmentItem(item(dagger, inactiveFacts), dagger), "attack_mode_ob", {
        attackModeId: "slash",
        kind: "attack_mode",
      }),
    ).toMatchObject({ activationState: "revealed_inactive", effectiveValue: 7 });

    inactiveFacts.characteristics![0] = {
      ...inactiveFacts.characteristics![0]!,
      active: true,
    };
    expect(
      characteristic(projectEquipmentItem(item(dagger, inactiveFacts), dagger), "attack_mode_ob", {
        attackModeId: "slash",
        kind: "attack_mode",
      }),
    ).toMatchObject({ activationState: "revealed_active", effectiveValue: 9 });
  });

  it("keeps final_attack_ob_delta distinct and exposes it only at the late calculation stage", () => {
    const projection = projectEquipmentItem(
      item(dagger, {
        activeMechanics: [
          {
            calculationStage: "final_attack_ob",
            id: "late-ob",
            kind: "final_attack_ob_delta",
            scope: "all_attack_modes",
            unit: "ob_points",
            value: 3,
            visibility: "revealed",
          },
        ],
        characteristics: [],
        descriptiveTraits: [],
        templateOverrides: [],
        unsupportedCapabilities: [],
        version: 1,
      }),
      dagger,
    );

    expect(
      characteristic(projection, "attack_mode_ob", { attackModeId: "slash", kind: "attack_mode" })
        .effectiveValue,
    ).toBe(7);
    expect(
      characteristic(projection, "final_attack_ob_delta", { kind: "equipment" }),
    ).toMatchObject({
      calculationStage: "final_attack_ob",
      effectiveValue: 3,
      templateValue: 0,
    });
    expect(getFinalAttackObDelta(projection)).toBe(3);
  });

  it("changes only one armor location and recomputes, but never authors, derived general armor", () => {
    const projection = projectEquipmentItem(
      item(armor, {
        activeMechanics: [],
        characteristics: [
          {
            id: "chest-plus-nine",
            kind: "armor_location_value_delta",
            scope: { kind: "armor_location", location: "chest" },
            unit: "armor_points",
            value: 9,
            visibility: "revealed",
          },
          {
            id: "chest-critical",
            kind: "armor_location_critical_modifier_delta",
            scope: { kind: "armor_location", location: "chest" },
            unit: "critical_modifier_points",
            value: 1,
            visibility: "revealed",
          },
          {
            id: "general-critical",
            kind: "armor_general_critical_modifier_delta",
            scope: { kind: "equipment" },
            unit: "critical_modifier_points",
            value: -1,
            visibility: "revealed",
          },
          {
            id: "armor-activity",
            kind: "armor_activity_modifier_delta",
            scope: { kind: "equipment" },
            unit: "activity_modifier_points",
            value: 1,
            visibility: "revealed",
          },
          {
            id: "armor-perception",
            kind: "armor_perception_modifier_delta",
            scope: { kind: "equipment" },
            unit: "perception_modifier_points",
            value: 2,
            visibility: "revealed",
          },
        ],
        descriptiveTraits: [],
        templateOverrides: [],
        unsupportedCapabilities: [],
        version: 1,
      }),
      armor,
    );

    expect(
      characteristic(projection, "armor_location_value", {
        kind: "armor_location",
        location: "chest",
      }).effectiveValue,
    ).toBe(18);
    expect(
      characteristic(projection, "armor_location_value", {
        kind: "armor_location",
        location: "head",
      }).effectiveValue,
    ).toBe(9);
    expect(characteristic(projection, "armor_general", { kind: "equipment" })).toMatchObject({
      authorable: false,
      derived: true,
      effectiveValue: 10,
    });
    expect(
      characteristic(projection, "armor_general_rounded", { kind: "equipment" }),
    ).toMatchObject({
      authorable: false,
      effectiveValue: 10,
    });
    expect(
      characteristic(projection, "armor_location_critical_modifier", {
        kind: "armor_location",
        location: "chest",
      }).effectiveValue,
    ).toBe(3);
    expect(
      characteristic(projection, "armor_location_critical_modifier", {
        kind: "armor_location",
        location: "head",
      }).effectiveValue,
    ).toBe(2);
    expect(
      characteristic(projection, "armor_general_critical_modifier", { kind: "equipment" })
        .effectiveValue,
    ).toBe(1);
    expect(
      characteristic(projection, "armor_activity_modifier", { kind: "equipment" }).effectiveValue,
    ).toBe(0);
    expect(
      characteristic(projection, "armor_perception_modifier", { kind: "equipment" }).effectiveValue,
    ).toBe(-1);
  });

  it("projects supported shield deltas while keeping aliases read-only", () => {
    const projection = projectEquipmentItem(
      item(shield, {
        activeMechanics: [],
        characteristics: [
          {
            id: "shield-parry",
            kind: "shield_parry_delta",
            scope: { kind: "equipment" },
            unit: "parry_points",
            value: 1,
            visibility: "revealed",
          },
          {
            id: "shield-dv",
            kind: "shield_defensive_value_delta",
            scope: { kind: "equipment" },
            unit: "defensive_value_points",
            value: 2,
            visibility: "revealed",
          },
        ],
        descriptiveTraits: [],
        templateOverrides: [],
        unsupportedCapabilities: [],
        version: 1,
      }),
      shield,
    );

    expect(characteristic(projection, "shield_parry", { kind: "equipment" }).effectiveValue).toBe(
      3,
    );
    expect(
      characteristic(projection, "shield_defensive_value", { kind: "equipment" }).effectiveValue,
    ).toBe(6);
    expect(characteristic(projection, "shield_bonus_alias", { kind: "equipment" })).toMatchObject({
      authorable: false,
      effectiveValue: 3,
    });
  });

  it("faithfully projects unsupported range/Critical truth and preserves deterministic reload", () => {
    const original = item(dagger);
    const before = structuredClone(original);
    const first = projectEquipmentItem(original, dagger);
    const reloaded = CanonicalEquipmentItemSchema.parse(JSON.parse(JSON.stringify(original)));
    const second = projectEquipmentItem(
      reloaded,
      JSON.parse(JSON.stringify(dagger)) as WeaponTemplate,
    );

    expect(
      characteristic(first, "attack_mode_range", { attackModeId: "slash", kind: "attack_mode" }),
    ).toMatchObject({
      authorable: false,
      effectiveValue: "1.5",
    });
    expect(
      characteristic(first, "attack_mode_critical_code", {
        attackModeId: "slash",
        kind: "attack_mode",
      }),
    ).toMatchObject({
      authorable: false,
      effectiveValue: "EP",
    });
    expect(first).toEqual(second);
    expect(original).toEqual(before);
    expect(original.holderCharacterId).toBe("character-themistogenes");
    expect(original.storageAssignment).toEqual(before.storageAssignment);
  });

  it("uses positive max-durability and typed encumbrance/value compatibility replacements", () => {
    const projection = projectEquipmentItem(
      item(dagger, undefined, {
        durabilityMax: 12,
        encumbranceOverride: 1,
        valueOverride: 50,
      }),
      dagger,
    );

    expect(characteristic(projection, "maximum_durability", { kind: "equipment" })).toMatchObject({
      effectiveValue: 12,
      templateValue: 10,
    });
    expect(
      characteristic(projection, "base_encumbrance", { kind: "equipment" }).effectiveValue,
    ).toBe(1);
    expect(characteristic(projection, "base_value", { kind: "equipment" }).effectiveValue).toBe(50);
    expect(() =>
      CanonicalEquipmentItemSchema.parse({ ...item(dagger), durabilityMax: 0 }),
    ).toThrow();
  });

  it("rejects hidden-active, duplicate-scope, competing initiative, and unsupported DMB authoring", () => {
    expect(() =>
      EquipmentItemFactsV1Schema.parse({
        characteristics: [
          {
            active: true,
            id: "hidden-active",
            kind: "attack_mode_ob_delta",
            scope: { attackModeId: "slash", kind: "attack_mode" },
            unit: "ob_points",
            value: 1,
            visibility: "gm_only",
          },
        ],
        version: 1,
      }),
    ).toThrow("Hidden Item mechanics must be dormant");

    expect(() =>
      EquipmentItemFactsV1Schema.parse({
        characteristics: [
          {
            id: "one",
            kind: "fallback_initiative_delta",
            scope: { kind: "equipment" },
            unit: "initiative_points",
            value: 1,
            visibility: "revealed",
          },
          {
            id: "two",
            kind: "fallback_initiative_delta",
            scope: { kind: "equipment" },
            unit: "initiative_points",
            value: 2,
            visibility: "revealed",
          },
        ],
        version: 1,
      }),
    ).toThrow("do not stack by kind and scope");

    expect(() =>
      EquipmentItemFactsV1Schema.parse({
        characteristics: [
          {
            id: "typed",
            kind: "fallback_initiative_delta",
            scope: { kind: "equipment" },
            unit: "initiative_points",
            value: 1,
            visibility: "revealed",
          },
        ],
        templateOverrides: [
          { id: "legacy", kind: "weapon_initiative_override", value: 1, visibility: "revealed" },
        ],
        version: 1,
      }),
    ).toThrow("cannot be competing authorities");

    const special = structuredClone(dagger);
    special.attackModes![0]!.dmb = null;
    special.attackModes![0]!.dmbFormula = {
      kind: "special",
      raw: "special",
      specialValue: "special",
    };
    expect(() =>
      projectEquipmentItem(
        item(special, {
          activeMechanics: [],
          characteristics: [
            {
              id: "bad-dmb",
              kind: "attack_mode_dmb_delta",
              scope: { attackModeId: "slash", kind: "attack_mode" },
              unit: "dmb_points",
              value: 1,
              visibility: "revealed",
            },
          ],
          descriptiveTraits: [],
          templateOverrides: [],
          unsupportedCapabilities: [],
          version: 1,
        }),
        special,
      ),
    ).toThrow("special DMB formulas are inherited but not Item-authorable");
  });
});
